//! A host on another machine: `cogno server --stdio` behind a process this
//! app starts (ssh), spoken to in the host's wire format. Requests go out
//! with an id and their replies come back under it; events go to the same
//! sink the embedded host reports to.

use cogno_host::protocol::{Reply, Request};
use cogno_host::wire::{self, HostMessage, RequestEnvelope, PROTOCOL_VERSION};
use cogno_host::EventSink;
use std::collections::HashMap;
use std::io::{Read, Write};
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

pub struct RemoteHost {
    writer: Mutex<Box<dyn Write + Send>>,
    waiting: Arc<Mutex<Waiting>>,
    next_id: AtomicU64,
    os: String,
    /// The process the streams belong to; ended with the connection.
    process: Mutex<Option<Child>>,
}

impl RemoteHost {
    /// Starts `command` and talks to the host it reaches. Returns once the
    /// host has introduced itself, which can take as long as the user needs
    /// to answer what the process asks (a password, a host key).
    pub fn connect(
        mut command: Command,
        sink: Arc<dyn EventSink>,
        on_lost: impl FnOnce() + Send + 'static,
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

        match Self::attach(stdout, stdin, sink, on_lost) {
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

    /// Talks to the host behind the two streams. `on_lost` runs once, when
    /// the host's stream ends.
    fn attach(
        mut reader: impl Read + Send + 'static,
        writer: impl Write + Send + 'static,
        sink: Arc<dyn EventSink>,
        on_lost: impl FnOnce() + Send + 'static,
    ) -> Result<Self, String> {
        wire::skip_to_preamble(&mut reader)
            .map_err(|_| "No Cogno answered on the other machine".to_string())?;
        let os = match wire::read_host_message(&mut reader) {
            Ok(Some(HostMessage::Hello { protocol, os })) if protocol == PROTOCOL_VERSION => os,
            Ok(Some(HostMessage::Hello { protocol, .. })) => {
                return Err(format!(
                    "The Cogno on the other machine speaks protocol {protocol}, this one \
                     {PROTOCOL_VERSION}: both need the same version"
                ))
            }
            _ => return Err("The Cogno on the other machine did not introduce itself".to_string()),
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
                on_lost();
            });
        }
        Ok(Self {
            writer: Mutex::new(Box::new(writer)),
            waiting,
            next_id: AtomicU64::new(1),
            os,
            process: Mutex::new(None),
        })
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
        self.send(self.next_id.fetch_add(1, Ordering::Relaxed), request)
    }
}

impl Drop for RemoteHost {
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
    use std::sync::atomic::AtomicBool;
    use std::time::{Duration, Instant};

    struct NoEvents;
    impl EventSink for NoEvents {
        fn emit(&self, _event: Event) -> bool {
            true
        }
    }

    /// A host serving one end of two pipes, and the connection at the other.
    fn connected(on_lost: impl FnOnce() + Send + 'static) -> RemoteHost {
        let (to_host, from_client) = std::io::pipe().unwrap();
        let (to_client, from_host) = std::io::pipe().unwrap();
        // The pipe's writer goes first: the server's output must be `Write`.
        let (host_input, host_output) = (to_host, from_host);
        std::thread::spawn(move || cogno_host::serve(host_input, host_output));
        RemoteHost::attach(to_client, from_client, Arc::new(NoEvents), on_lost).unwrap()
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
        let refused = RemoteHost::attach(reader, std::io::sink(), Arc::new(NoEvents), || {});
        assert_eq!(
            refused.err().unwrap(),
            "No Cogno answered on the other machine"
        );
    }

    #[test]
    fn another_protocol_version_is_refused_with_both_versions() {
        let (reader, mut writer) = std::io::pipe().unwrap();
        // A hello as `wire` writes it, with the version of a later Cogno.
        let mut hello = Vec::new();
        wire::write_hello(&mut hello).unwrap();
        let current = format!("\"protocol\":{PROTOCOL_VERSION}");
        let later = format!("\"protocol\":{}", PROTOCOL_VERSION + 1);
        assert_eq!(current.len(), later.len());
        let hello = String::from_utf8_lossy(&hello).replace(&current, &later);
        writer.write_all(hello.as_bytes()).unwrap();

        let refused = RemoteHost::attach(reader, std::io::sink(), Arc::new(NoEvents), || {});
        let error = refused.err().unwrap();
        assert!(error.contains(&format!("protocol {}", PROTOCOL_VERSION + 1)));
    }

    #[test]
    fn a_lost_connection_fails_what_waits_and_is_reported_once() {
        let (to_host, from_client) = std::io::pipe().unwrap();
        let (to_client, mut from_host) = std::io::pipe().unwrap();
        wire::write_hello(&mut from_host).unwrap();
        let lost = Arc::new(AtomicBool::new(false));
        let host = {
            let lost = lost.clone();
            RemoteHost::attach(to_client, from_client, Arc::new(NoEvents), move || {
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
