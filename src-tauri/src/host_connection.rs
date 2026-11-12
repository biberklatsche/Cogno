//! A connection to a host, spoken in the host's wire format: to this
//! machine's daemon directly, or to another machine's through a process this
//! app starts (ssh, with `cogno server --stdio` at the other end). Requests
//! go out with an id and their replies come back under it; events go to the
//! sink the connection was given.

use cogno_host::protocol::{Reply, Request};
use cogno_host::wire::{self, HostMessage, RequestEnvelope, VersionMismatch, NO_REPLY};
use cogno_host::EventSink;
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

const LOST: &str = "The connection to the host is lost";
/// How much of what the process printed on stderr an error quotes.
const STDERR_LIMIT: usize = 2000;

#[derive(Default)]
struct Waiting {
    replies: HashMap<u64, mpsc::Sender<Reply>>,
    /// Once set, nothing is answered any more.
    lost: bool,
}

/// Tells connections apart, also two to the same host one after the other.
static NEXT_CONNECTION: AtomicU64 = AtomicU64::new(1);

pub struct HostConnection {
    /// Unique among the connections of this app.
    id: u64,
    writer: Mutex<Box<dyn Write + Send>>,
    waiting: Arc<Mutex<Waiting>>,
    next_id: AtomicU64,
    os: String,
    /// The process the streams belong to, if this app started one; ended
    /// with the connection.
    process: Mutex<Option<Child>>,
}

impl HostConnection {
    /// Starts `command` and talks to the host it reaches. Returns once the
    /// host has introduced itself, which can take as long as the user needs
    /// to answer what the process asks (a password, a host key).
    pub fn connect(
        mut command: Command,
        sink: Arc<dyn EventSink>,
        on_lost: impl FnOnce(u64) + Send + 'static,
    ) -> Result<Self, String> {
        let mut process = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("Could not start the connection: {error}"))?;
        let stdin = process.stdin.take().expect("piped");
        let stdout = process.stdout.take().expect("piped");
        let mut stderr = process.stderr.take().expect("piped");
        let said = Arc::new(Mutex::new(Vec::new()));
        {
            let said = said.clone();
            std::thread::spawn(move || {
                let mut buffer = [0u8; 512];
                while let Ok(read) = stderr.read(&mut buffer) {
                    if read == 0 {
                        break;
                    }
                    let mut said = said.lock().unwrap();
                    let room = STDERR_LIMIT.saturating_sub(said.len());
                    said.extend_from_slice(&buffer[..read.min(room)]);
                }
            });
        }

        match Self::over(stdout, stdin, sink, on_lost) {
            Ok(mut host) => {
                host.process = Mutex::new(Some(process));
                Ok(host)
            }
            Err(error) => {
                // What ssh said is the better explanation: "Permission
                // denied", "Could not resolve hostname", "command not found".
                let _ = process.kill();
                let _ = process.wait();
                let said = String::from_utf8_lossy(&said.lock().unwrap())
                    .trim()
                    .to_string();
                Err(if said.is_empty() {
                    error
                } else {
                    format!("{error}: {said}")
                })
            }
        }
    }

    /// Talks to the host behind the two streams. Returns once the host has
    /// introduced itself; `on_lost` runs once, with the connection's id, when
    /// the host's stream ends.
    pub fn over(
        reader: impl Read + Send + 'static,
        writer: impl Write + Send + 'static,
        sink: Arc<dyn EventSink>,
        on_lost: impl FnOnce(u64) + Send + 'static,
    ) -> Result<Self, String> {
        // Every frame is read in pieces (its header, then its body): from a
        // buffer, not one system call each.
        let mut reader = BufReader::with_capacity(64 * 1024, reader);
        let id = NEXT_CONNECTION.fetch_add(1, Ordering::Relaxed);
        wire::skip_to_preamble(&mut reader).map_err(|_| "No Cogno host answered".to_string())?;
        let os = match wire::read_host_message(&mut reader) {
            Ok(Some(HostMessage::Hello {
                protocol,
                oldest,
                os,
            })) => match wire::check_versions(protocol, oldest) {
                Ok(_) => os,
                Err(VersionMismatch::ThisIsOlder) => {
                    return Err("The Cogno host is newer than this Cogno can talk to: \
                         update this Cogno"
                        .to_string())
                }
                Err(VersionMismatch::TheyAreOlder) => {
                    return Err("The Cogno host is older than this Cogno can talk to: \
                         update the Cogno there"
                        .to_string())
                }
            },
            _ => return Err("The Cogno host did not introduce itself".to_string()),
        };

        let waiting = Arc::new(Mutex::new(Waiting::default()));
        {
            let waiting = waiting.clone();
            std::thread::spawn(move || {
                while let Ok(Some(message)) = wire::read_host_message(&mut reader) {
                    match message {
                        HostMessage::Reply { id, reply } => {
                            // Nobody waits for the reply to a posted request.
                            if let Some(waiter) = waiting.lock().unwrap().replies.remove(&id) {
                                let _ = waiter.send(reply);
                            }
                        }
                        HostMessage::Event(event) => {
                            sink.emit(event);
                        }
                        HostMessage::Hello { .. } => {}
                    }
                }
                {
                    let mut waiting = waiting.lock().unwrap();
                    waiting.lost = true;
                    // Dropping the senders fails every request still waiting.
                    waiting.replies.clear();
                }
                on_lost(id);
            });
        }
        Ok(Self {
            id,
            writer: Mutex::new(Box::new(writer)),
            waiting,
            next_id: AtomicU64::new(1),
            os,
            process: Mutex::new(None),
        })
    }

    pub fn id(&self) -> u64 {
        self.id
    }

    pub fn is_lost(&self) -> bool {
        self.waiting.lock().unwrap().lost
    }

    /// `std::env::consts::OS` of the machine the host runs on.
    pub fn os(&self) -> &str {
        &self.os
    }

    fn send(&self, id: u64, request: Request) -> Result<(), String> {
        wire::write_request(
            &mut *self.writer.lock().unwrap(),
            &RequestEnvelope { id, request },
        )
        .map_err(|_| LOST.to_string())
    }

    /// Sends a request and waits for its reply: never on a thread that must
    /// not block.
    pub fn request(&self, request: Request) -> Reply {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::channel();
        {
            let mut waiting = self.waiting.lock().unwrap();
            if waiting.lost {
                return Err(LOST.to_string());
            }
            waiting.replies.insert(id, sender);
        }
        if let Err(error) = self.send(id, request) {
            self.waiting.lock().unwrap().replies.remove(&id);
            return Err(error);
        }
        receiver.recv().unwrap_or_else(|_| Err(LOST.to_string()))
    }

    /// Sends a request without waiting for its reply: for what is typed,
    /// resized and acknowledged, where the round trip would only add delay.
    pub fn post(&self, request: Request) -> Result<(), String> {
        // The host does not answer it: nobody would read the answer.
        self.send(NO_REPLY, request)
    }
}

impl Drop for HostConnection {
    fn drop(&mut self) {
        // The host ends with its input; the process is not left to notice.
        if let Some(mut process) = self.process.lock().unwrap().take() {
            let _ = process.kill();
            let _ = process.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cogno_host::protocol::{Event, Response};
    use cogno_host::wire::{OLDEST_PROTOCOL_VERSION, PROTOCOL_VERSION};
    use std::sync::atomic::AtomicBool;
    use std::time::{Duration, Instant};

    struct NoEvents;
    impl EventSink for NoEvents {
        fn emit(&self, _event: Event) -> bool {
            true
        }
    }

    /// A daemon of this test's own, and a connection to it.
    fn connected(on_lost: impl FnOnce() + Send + 'static) -> HostConnection {
        let endpoint = std::env::temp_dir().join(format!(
            "cogno-connection-test-{}.json",
            uuid::Uuid::new_v4().simple()
        ));
        {
            let endpoint = endpoint.clone();
            std::thread::spawn(move || {
                cogno_host::daemon::run(&endpoint, cogno_host::daemon::Patience::default())
            });
        }
        let started = Instant::now();
        let stream = loop {
            match cogno_host::daemon::connect(&endpoint) {
                Ok(stream) => break stream,
                Err(_) => {
                    assert!(started.elapsed() < Duration::from_secs(10));
                    std::thread::sleep(Duration::from_millis(20));
                }
            }
        };
        let reader = stream.try_clone().unwrap();
        HostConnection::over(reader, stream, Arc::new(NoEvents), move |_| on_lost()).unwrap()
    }

    #[test]
    fn a_request_gets_the_reply_with_its_id() {
        let host = connected(|| {});
        assert_eq!(host.os(), std::env::consts::OS);

        let unknown = host.request(Request::PtyResize {
            terminal_id: "nobody".into(),
            cols: 80,
            rows: 24,
        });
        assert_eq!(unknown.unwrap_err(), "Session not found: nobody");
        // A posted request's reply is nobody's: the next one still gets its own.
        host.post(Request::PtyAck {
            terminal_id: "nobody".into(),
            seq: 0,
        })
        .unwrap();
        let acknowledged = host.request(Request::PtyAck {
            terminal_id: "nobody".into(),
            seq: 1,
        });
        assert!(matches!(acknowledged, Ok(Response::Done)));
    }

    #[test]
    fn a_stream_without_a_cogno_behind_it_is_refused() {
        let (reader, mut writer) = std::io::pipe().unwrap();
        writer
            .write_all(b"bash: cogno: command not found\n")
            .unwrap();
        drop(writer);
        let refused = HostConnection::over(reader, std::io::sink(), Arc::new(NoEvents), |_| {});
        assert_eq!(refused.err().unwrap(), "No Cogno host answered");
    }

    /// A connection to a host that says it speaks `oldest` up to `newest`.
    fn over_a_host_speaking(newest: u32, oldest: u32) -> Result<HostConnection, String> {
        let (reader, mut writer) = std::io::pipe().unwrap();
        // A hello as `wire` writes it, with the versions of another Cogno.
        let mut hello = Vec::new();
        wire::write_hello(&mut hello).unwrap();
        let ours = format!("\"protocol\":{PROTOCOL_VERSION},\"oldest\":{OLDEST_PROTOCOL_VERSION}");
        let theirs = format!("\"protocol\":{newest},\"oldest\":{oldest}");
        // The frame keeps its length.
        assert_eq!(ours.len(), theirs.len());
        let changed = String::from_utf8_lossy(&hello).replace(&ours, &theirs);
        assert_ne!(
            changed.as_bytes(),
            &hello[..],
            "the hello names both versions"
        );
        writer.write_all(changed.as_bytes()).unwrap();
        HostConnection::over(reader, std::io::sink(), Arc::new(NoEvents), |_| {})
    }

    #[test]
    fn a_later_host_that_still_speaks_this_version_is_talked_to() {
        assert!(over_a_host_speaking(PROTOCOL_VERSION + 1, PROTOCOL_VERSION).is_ok());
    }

    #[test]
    fn a_host_without_a_version_in_common_is_refused_naming_what_to_update() {
        let error = over_a_host_speaking(PROTOCOL_VERSION + 2, PROTOCOL_VERSION + 1)
            .err()
            .unwrap();
        assert!(error.ends_with("update this Cogno"), "{error}");
    }

    #[test]
    fn a_lost_connection_fails_what_waits_and_is_reported_once() {
        let (to_host, from_client) = std::io::pipe().unwrap();
        let (to_client, mut from_host) = std::io::pipe().unwrap();
        wire::write_hello(&mut from_host).unwrap();
        let lost = Arc::new(AtomicBool::new(false));
        let host = {
            let lost = lost.clone();
            HostConnection::over(to_client, from_client, Arc::new(NoEvents), move |_| {
                lost.store(true, Ordering::SeqCst)
            })
            .unwrap()
        };

        // The host never answers and then goes away.
        let hang_up = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            drop(from_host);
            drop(to_host);
        });
        let reply = host.request(Request::ListShells);
        assert_eq!(reply.unwrap_err(), LOST);
        hang_up.join().unwrap();

        let started = Instant::now();
        while !lost.load(Ordering::SeqCst) {
            assert!(started.elapsed() < Duration::from_secs(5));
            std::thread::sleep(Duration::from_millis(10));
        }
        assert_eq!(host.request(Request::ListShells).unwrap_err(), LOST);
    }
}
