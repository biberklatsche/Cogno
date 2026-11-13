//! A connection to a host, spoken in the host's wire format: to this
//! machine's daemon directly, or to another machine's through a process this
//! app starts (ssh, with `cogno server --stdio` at the other end). Requests
//! go out with an id and their replies come back under it; events and
//! output go to the sink the connection was given.
//!
//! What goes out is written by a thread of the connection's own: sending
//! never blocks, so a host that is slow to read (a stalled ssh) never holds
//! up the thread that drives the UI.

use cogno_host::protocol::{Request, Response};
use cogno_host::wire::{self, ClientHello, ClientMessage, HostMessage, VersionMismatch};
use cogno_host::EventSink;
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};

/// How much of what the process printed on stderr an error quotes.
const STDERR_LIMIT: usize = 2000;
/// What is read from stderr in one go.
const STDERR_READ_LEN: usize = 512;
/// Every frame is read in pieces (its header, then its body): from a buffer
/// of this size, not one system call each.
const READ_BUFFER_LEN: usize = 64 * 1024;
/// The first request id; ids count up from here.
const FIRST_REQUEST_ID: u64 = 1;

#[derive(Default)]
struct Waiting {
    replies: HashMap<u64, mpsc::Sender<cogno_host::protocol::Reply>>,
    /// Once set, nothing is answered any more.
    lost: bool,
}

/// Tells connections apart, also two to the same host one after the other.
static NEXT_CONNECTION: AtomicU64 = AtomicU64::new(1);

/// Which host a connection reaches, for what its errors say.
#[derive(Clone, Copy)]
pub enum Reaching<'a> {
    ThisMachine,
    Remote(&'a str),
}

/// What ends the connection itself: the process this app started, or the
/// socket. Run when the connection is dropped, so the host learns at once
/// that this app is gone.
pub type HangUp = Box<dyn FnOnce() + Send + Sync>;

pub struct HostConnection {
    /// Unique among the connections of this app.
    id: u64,
    outgoing: mpsc::Sender<ClientMessage>,
    waiting: Arc<Mutex<Waiting>>,
    next_id: AtomicU64,
    os: String,
    hang_up: Mutex<Option<HangUp>>,
}

impl HostConnection {
    /// Starts `command` and talks to the host it reaches. Returns once the
    /// two have introduced each other, which can take as long as the user
    /// needs to answer what the process asks (a password, a host key).
    pub fn connect(
        mut command: Command,
        reaching: Reaching<'_>,
        sink: Arc<dyn EventSink>,
        on_lost: impl FnOnce(u64) + Send + 'static,
    ) -> CommandResult<Self> {
        let mut process = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| {
                CommandError::new(
                    AppErrorCode::ConnectFailed,
                    format!("Could not start the connection: {error}"),
                )
            })?;
        let stdin = process.stdin.take().expect("piped");
        let stdout = process.stdout.take().expect("piped");
        let said = collect_stderr(process.stderr.take().expect("piped"));
        let process = Arc::new(Mutex::new(process));
        let end_process = {
            let process = process.clone();
            move || end(&mut lock(&process))
        };

        Self::over(
            stdout,
            stdin,
            reaching,
            sink,
            on_lost,
            Box::new(end_process),
        )
        .map_err(|mut error| {
            // What ssh said is the better explanation: "Permission
            // denied", "Could not resolve hostname", "command not found".
            end(&mut lock(&process));
            let said = String::from_utf8_lossy(&lock(&said)).trim().to_string();
            if !said.is_empty() {
                error.message = format!("{}: {said}", error.message);
            }
            error
        })
    }

    /// Talks to the host behind the two streams. Returns once the two have
    /// introduced each other; `on_lost` runs once, with the connection's id,
    /// when the host's stream ends, and `hang_up` when the connection is
    /// dropped.
    pub fn over(
        reader: impl Read + Send + 'static,
        mut writer: impl Write + Send + 'static,
        reaching: Reaching<'_>,
        sink: Arc<dyn EventSink>,
        on_lost: impl FnOnce(u64) + Send + 'static,
        hang_up: HangUp,
    ) -> CommandResult<Self> {
        let mut reader = BufReader::with_capacity(READ_BUFFER_LEN, reader);
        let id = NEXT_CONNECTION.fetch_add(1, Ordering::Relaxed);
        wire::skip_to_preamble(&mut reader).map_err(|_| no_cogno(reaching))?;
        let hello = wire::read_host_hello(&mut reader).map_err(|_| {
            CommandError::new(
                AppErrorCode::ConnectFailed,
                "The Cogno host did not introduce itself",
            )
        })?;
        wire::check_versions(hello.protocol, hello.oldest)
            .map_err(|mismatch| version_error(mismatch, reaching))?;
        let introduction = ClientHello::of_this_build(cogno_host::identity::machine_name());
        wire::write_client_hello(&mut writer, &introduction)
            .map_err(|_| CommandError::connection_lost())?;

        let waiting = Arc::new(Mutex::new(Waiting::default()));
        {
            let waiting = waiting.clone();
            std::thread::spawn(move || {
                while let Ok(Some(message)) = wire::read_host_message(&mut reader) {
                    match message {
                        HostMessage::Reply { id, reply } => {
                            if let Some(waiter) = lock(&waiting).replies.remove(&id) {
                                let _ = waiter.send(reply);
                            }
                        }
                        HostMessage::Event(event) => {
                            sink.event(event);
                        }
                        HostMessage::Output(output) => {
                            sink.output(output);
                        }
                        HostMessage::Hello(_) => {}
                    }
                }
                {
                    let mut waiting = lock(&waiting);
                    waiting.lost = true;
                    // Dropping the senders fails every request still waiting.
                    waiting.replies.clear();
                }
                on_lost(id);
            });
        }
        Ok(Self {
            id,
            outgoing: spawn_writer(writer),
            waiting,
            next_id: AtomicU64::new(FIRST_REQUEST_ID),
            os: hello.os,
            hang_up: Mutex::new(Some(hang_up)),
        })
    }

    pub fn id(&self) -> u64 {
        self.id
    }

    pub fn is_lost(&self) -> bool {
        lock(&self.waiting).lost
    }

    /// `std::env::consts::OS` of the machine the host runs on.
    pub fn os(&self) -> &str {
        &self.os
    }

    /// Queues `message` for the writer thread. Never blocks.
    fn send(&self, message: ClientMessage) -> CommandResult<()> {
        self.outgoing
            .send(message)
            .map_err(|_| CommandError::connection_lost())
    }

    /// Sends a request and waits for its reply: never on a thread that must
    /// not block.
    pub fn request(&self, request: Request) -> CommandResult<Response> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::channel();
        {
            let mut waiting = lock(&self.waiting);
            if waiting.lost {
                return Err(CommandError::connection_lost());
            }
            waiting.replies.insert(id, sender);
        }
        if let Err(error) = self.send(ClientMessage::Request { id, request }) {
            lock(&self.waiting).replies.remove(&id);
            return Err(error);
        }
        let reply = receiver
            .recv()
            .map_err(|_| CommandError::connection_lost())?;
        Ok(reply?)
    }

    /// Sends a request without waiting for its reply: for what is typed,
    /// resized and acknowledged, where the round trip would only add delay.
    pub fn post(&self, request: Request) -> CommandResult<()> {
        self.send(ClientMessage::Post { request })
    }
}

impl Drop for HostConnection {
    fn drop(&mut self) {
        if let Some(hang_up) = lock(&self.hang_up).take() {
            hang_up();
        }
    }
}

/// Writes what is queued, in order, until the connection is dropped or the
/// host can no longer be written to.
fn spawn_writer(mut writer: impl Write + Send + 'static) -> mpsc::Sender<ClientMessage> {
    let (outgoing, queued) = mpsc::channel::<ClientMessage>();
    std::thread::spawn(move || {
        for message in queued {
            if wire::write_client_message(&mut writer, message).is_err() {
                return;
            }
        }
    });
    outgoing
}

/// Ends the process of a connection; the host ends with its input.
fn end(process: &mut Child) {
    let _ = process.kill();
    let _ = process.wait();
}

/// Collects what the process prints on stderr, up to `STDERR_LIMIT`.
fn collect_stderr(mut stderr: impl Read + Send + 'static) -> Arc<Mutex<Vec<u8>>> {
    let said = Arc::new(Mutex::new(Vec::new()));
    {
        let said = said.clone();
        std::thread::spawn(move || {
            let mut buffer = [0u8; STDERR_READ_LEN];
            while let Ok(read) = stderr.read(&mut buffer) {
                if read == 0 {
                    break;
                }
                let mut said = lock(&said);
                let room = STDERR_LIMIT.saturating_sub(said.len());
                said.extend_from_slice(&buffer[..read.min(room)]);
            }
        });
    }
    said
}

fn no_cogno(reaching: Reaching<'_>) -> CommandError {
    CommandError::new(
        AppErrorCode::NoCognoThere,
        match reaching {
            Reaching::ThisMachine => "The Cogno host of this machine did not answer",
            Reaching::Remote(_) => "No Cogno host answered",
        },
    )
}

/// Which Cogno to update, said for the host it is about.
fn version_error(mismatch: VersionMismatch, reaching: Reaching<'_>) -> CommandError {
    match (mismatch, reaching) {
        (VersionMismatch::ThisIsOlder, _) => CommandError::new(
            AppErrorCode::ThisCognoTooOld,
            "The Cogno host is newer than this Cogno can talk to: update this Cogno",
        ),
        (VersionMismatch::TheyAreOlder, Reaching::ThisMachine) => CommandError::new(
            AppErrorCode::HostTooOld,
            "The Cogno host of this machine is from an older Cogno, which this one cannot \
             talk to. It ends when its shells have ended",
        ),
        (VersionMismatch::TheyAreOlder, Reaching::Remote(name)) => CommandError::new(
            AppErrorCode::HostTooOld,
            format!("The Cogno on {name} is older than this Cogno can talk to: update it there"),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cogno_host::protocol::{Event, HostErrorCode, TerminalSize};
    use cogno_host::wire::{Output, OLDEST_PROTOCOL_VERSION, PROTOCOL_VERSION};
    use std::sync::atomic::AtomicBool;
    use std::time::{Duration, Instant};

    use crate::command_error::ErrorCode;

    struct NoEvents;
    impl EventSink for NoEvents {
        fn event(&self, _event: Event) -> bool {
            true
        }
        fn output(&self, _output: Output) -> bool {
            true
        }
    }

    /// A daemon of this test's own, and a connection to it.
    fn connected(on_lost: impl FnOnce() + Send + 'static) -> HostConnection {
        let endpoint = std::env::temp_dir()
            .join(format!(
                "cogno-connection-test-{}",
                uuid::Uuid::new_v4().simple()
            ))
            .join("host.json");
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
        HostConnection::over(
            reader,
            stream,
            Reaching::ThisMachine,
            Arc::new(NoEvents),
            move |_| on_lost(),
            Box::new(|| {}),
        )
        .unwrap()
    }

    #[test]
    fn a_request_gets_the_reply_with_its_id() {
        let host = connected(|| {});
        assert_eq!(host.os(), std::env::consts::OS);

        let unknown = host.request(Request::PtyResize {
            terminal_id: "nobody".into(),
            size: TerminalSize { cols: 80, rows: 24 },
        });
        assert_eq!(
            unknown.unwrap_err().code,
            ErrorCode::Host(HostErrorCode::SessionNotFound)
        );
        // A posted request gets no reply: the next one still gets its own.
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
        let refused = HostConnection::over(
            reader,
            std::io::sink(),
            Reaching::Remote("office"),
            Arc::new(NoEvents),
            |_| {},
            Box::new(|| {}),
        );
        assert!(refused.err().unwrap().is(AppErrorCode::NoCognoThere));
    }

    /// A connection to a host that says it speaks `oldest` up to `newest`.
    fn over_a_host_speaking(newest: u32, oldest: u32) -> CommandResult<HostConnection> {
        let (reader, mut writer) = std::io::pipe().unwrap();
        // A hello as `wire` writes it, with the versions of another Cogno.
        let mut hello = Vec::new();
        wire::write_host_hello(&mut hello).unwrap();
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
        HostConnection::over(
            reader,
            std::io::sink(),
            Reaching::Remote("office"),
            Arc::new(NoEvents),
            |_| {},
            Box::new(|| {}),
        )
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
        assert!(error.is(AppErrorCode::ThisCognoTooOld));
    }

    #[test]
    fn a_lost_connection_fails_what_waits_and_is_reported_once() {
        let (to_host, from_client) = std::io::pipe().unwrap();
        let (to_client, mut from_host) = std::io::pipe().unwrap();
        wire::write_host_hello(&mut from_host).unwrap();
        let lost = Arc::new(AtomicBool::new(false));
        let host = {
            let lost = lost.clone();
            HostConnection::over(
                to_client,
                from_client,
                Reaching::ThisMachine,
                Arc::new(NoEvents),
                move |_| lost.store(true, Ordering::SeqCst),
                Box::new(|| {}),
            )
            .unwrap()
        };

        // The host never answers and then goes away.
        let hang_up = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            drop(from_host);
            drop(to_host);
        });
        let reply = host.request(Request::ListShells);
        assert!(reply.unwrap_err().is(AppErrorCode::ConnectionLost));
        hang_up.join().unwrap();

        let started = Instant::now();
        while !lost.load(Ordering::SeqCst) {
            assert!(started.elapsed() < Duration::from_secs(5));
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(host
            .request(Request::ListShells)
            .unwrap_err()
            .is(AppErrorCode::ConnectionLost));
    }
}
