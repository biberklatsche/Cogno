//! A connection to a host, spoken in the host's wire format: to this
//! machine's host, or to the host of a paired machine (`pairing::dial`).
//! Requests go out with an id and their replies come back under it; events
//! and output go to the `HostEvents` the connection was given, which
//! answers what the host passes on over the same connection (`Answers`).
//!
//! What goes out is written by a thread of the connection's own: sending
//! never blocks, so a host that is slow to read never holds up the thread
//! that drives the UI.

use cogno_host::protocol::{Event, RelayId, Reply, Request, Response};
use cogno_host::wire::{
    self, ClientHello, ClientMessage, HostMessage, IntroductionError, Output, VersionMismatch,
};
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::net::{Shutdown, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};

/// Every frame is read in pieces (its header, then its body): from a buffer
/// of this size, not one system call each.
const READ_BUFFER_LEN: usize = 64 * 1024;
/// The first request id; ids count up from here.
const FIRST_REQUEST_ID: u64 = 1;
#[derive(Default)]
struct Waiting {
    replies: HashMap<u64, mpsc::Sender<Reply>>,
    /// Once set, nothing is answered any more.
    lost: bool,
}

/// Tells connections apart, also two to the same host one after the other.
static NEXT_CONNECTION: AtomicU64 = AtomicU64::new(1);

/// How a connection ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ending {
    /// This app hung up: the user asked for it, or the app ends.
    HungUp,
    /// The host's stream ended without this app asking for it.
    Lost,
}

/// What ends a connection itself: it closes the stream. The host learns at
/// once that this app is gone.
pub type HangUp = Box<dyn FnOnce() + Send>;

/// What runs once a connection ended, with its id.
pub type OnLost = Box<dyn FnOnce(u64, Ending) + Send>;

/// Where what a host reports goes.
pub trait HostEvents: Send + Sync + 'static {
    /// An event; a question the host passed on is answered through `answers`.
    fn event(&self, event: Event, answers: &Answers);
    /// A piece of a session's output.
    fn output(&self, output: Output);
}

/// Answers what a host passed on (`Event::Asked`), over the connection the
/// question came through; also later, for a prompt the user takes a while
/// to answer.
#[derive(Clone)]
pub struct Answers(mpsc::Sender<ClientMessage>);

impl Answers {
    /// `answer` as the asker reads it; the host carries it as it is.
    pub fn answer(&self, relay: RelayId, answer: String) {
        let _ = self.0.send(ClientMessage::Post {
            request: Request::Answer { relay, answer },
        });
    }
}

pub struct HostConnection {
    /// Unique among the connections of this app.
    id: u64,
    outgoing: mpsc::Sender<ClientMessage>,
    waiting: Arc<Mutex<Waiting>>,
    next_id: AtomicU64,
    os: String,
    hang_up: Mutex<Option<HangUp>>,
    /// Set before this app hangs up, so the end is told as its own.
    hung_up: Arc<AtomicBool>,
}

impl HostConnection {
    /// Talks to this machine's host over `stream`.
    pub fn to_this_machine(
        stream: TcpStream,
        events: Arc<dyn HostEvents>,
        on_lost: OnLost,
    ) -> CommandResult<Self> {
        let reader = stream.try_clone().map_err(CommandError::internal)?;
        let closer = stream.try_clone().map_err(CommandError::internal)?;
        Self::over(
            reader,
            stream,
            None,
            events,
            on_lost,
            // The host learns at once that this app is gone, also while a
            // clone of the socket still reads.
            Box::new(move || {
                let _ = closer.shutdown(Shutdown::Both);
            }),
        )
    }

    /// Talks to the host behind the two streams: the one of the paired
    /// machine `host`, this machine's when `None`. Returns once the two have
    /// introduced each other; `on_lost` runs once, with the connection's id,
    /// when the host's stream ends, and `hang_up` when this app hangs up.
    pub fn over(
        reader: impl Read + Send + 'static,
        mut writer: impl Write + Send + 'static,
        host: Option<&str>,
        events: Arc<dyn HostEvents>,
        on_lost: OnLost,
        hang_up: HangUp,
    ) -> CommandResult<Self> {
        let mut reader = BufReader::with_capacity(READ_BUFFER_LEN, reader);
        let id = NEXT_CONNECTION.fetch_add(1, Ordering::Relaxed);
        let introduction = ClientHello::of_this_build(cogno_host::identity::machine_name());
        let hello =
            wire::introduce(&mut reader, &mut writer, &introduction).map_err(
                |error| match error {
                    IntroductionError::NoHost(_) => {
                        CommandError::new(AppErrorCode::NoCognoThere, "No Cogno host answered")
                    }
                    IntroductionError::NoHello(_) => CommandError::new(
                        AppErrorCode::ConnectFailed,
                        "The Cogno host did not introduce itself",
                    ),
                    IntroductionError::Versions(mismatch) => version_error(mismatch, host),
                    IntroductionError::Broken(_) => CommandError::connection_lost(),
                },
            )?;

        let waiting = Arc::new(Mutex::new(Waiting::default()));
        let hung_up = Arc::new(AtomicBool::new(false));
        let outgoing = spawn_writer(writer);
        {
            let waiting = waiting.clone();
            let hung_up = hung_up.clone();
            let answers = Answers(outgoing.clone());
            std::thread::spawn(move || {
                while let Ok(Some(message)) = wire::read_host_message(&mut reader) {
                    match message {
                        HostMessage::Reply { id, reply } => {
                            if let Some(waiter) = lock(&waiting).replies.remove(&id) {
                                let _ = waiter.send(reply);
                            }
                        }
                        HostMessage::Event(event) => events.event(event, &answers),
                        HostMessage::Output(output) => events.output(output),
                        HostMessage::Hello(_) => {}
                    }
                }
                {
                    let mut waiting = lock(&waiting);
                    waiting.lost = true;
                    // Dropping the senders fails every request still waiting.
                    waiting.replies.clear();
                }
                let ending = if hung_up.load(Ordering::SeqCst) {
                    Ending::HungUp
                } else {
                    Ending::Lost
                };
                on_lost(id, ending);
            });
        }
        Ok(Self {
            id,
            outgoing,
            waiting,
            next_id: AtomicU64::new(FIRST_REQUEST_ID),
            os: hello.os,
            hang_up: Mutex::new(Some(hang_up)),
            hung_up,
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

    /// Ends the connection now, whoever else still holds it: what waits for
    /// a reply fails, and the end is told as this app's own. Idempotent.
    pub fn hang_up(&self) {
        self.hung_up.store(true, Ordering::SeqCst);
        if let Some(hang_up) = lock(&self.hang_up).take() {
            hang_up();
        }
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
        let (_, reply) = self.ask(request)?;
        let reply = reply.recv().map_err(|_| CommandError::connection_lost())?;
        Ok(reply?)
    }

    /// Sends a request and waits for its reply for `patience` at most: `None`
    /// when the host did not answer in time.
    pub fn request_within(
        &self,
        request: Request,
        patience: Duration,
    ) -> Option<CommandResult<Response>> {
        let (id, reply) = match self.ask(request) {
            Ok(asked) => asked,
            Err(error) => return Some(Err(error)),
        };
        match reply.recv_timeout(patience) {
            Ok(reply) => Some(reply.map_err(CommandError::from)),
            Err(mpsc::RecvTimeoutError::Disconnected) => Some(Err(CommandError::connection_lost())),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // A reply that still comes finds nobody waiting.
                lock(&self.waiting).replies.remove(&id);
                None
            }
        }
    }

    /// Sends a request: its id, and where its reply arrives.
    fn ask(&self, request: Request) -> CommandResult<(u64, mpsc::Receiver<Reply>)> {
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
        Ok((id, receiver))
    }

    /// Sends a request without waiting for its reply: for what is typed,
    /// resized and acknowledged, where the round trip would only add delay.
    pub fn post(&self, request: Request) -> CommandResult<()> {
        self.send(ClientMessage::Post { request })
    }
}

impl Drop for HostConnection {
    fn drop(&mut self) {
        self.hang_up();
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

/// Which Cogno to update, said for the host it is about.
fn version_error(mismatch: VersionMismatch, host: Option<&str>) -> CommandError {
    match mismatch {
        VersionMismatch::ThisIsOlder => CommandError::new(
            AppErrorCode::ThisCognoTooOld,
            "The Cogno host is newer than this Cogno can talk to: update this Cogno",
        ),
        // The app runs this machine's host itself, so that one is never older.
        VersionMismatch::TheyAreOlder => CommandError::new(
            AppErrorCode::HostTooOld,
            format!(
                "The Cogno on {} is older than this Cogno can talk to: update it there",
                host.unwrap_or("this machine")
            ),
        ),
    }
}

#[cfg(test)]
pub mod test_support {
    use super::*;
    use std::io::{PipeReader, PipeWriter};

    pub struct NoEvents;
    impl HostEvents for NoEvents {
        fn event(&self, _event: Event, _answers: &Answers) {}
        fn output(&self, _output: Output) {}
    }

    /// A host that introduces itself and then answers nothing, until its
    /// ends of the two pipes are dropped.
    pub fn silent_host(on_lost: OnLost) -> (HostConnection, (PipeReader, PipeWriter)) {
        let (from_client, to_host) = std::io::pipe().unwrap();
        let (to_client, mut from_host) = std::io::pipe().unwrap();
        wire::write_host_hello(&mut from_host).unwrap();
        let host = HostConnection::over(
            to_client,
            to_host,
            None,
            Arc::new(NoEvents),
            on_lost,
            Box::new(|| {}),
        )
        .unwrap();
        (host, (from_client, from_host))
    }

    /// A host of the test's own, and the endpoint file it answers behind.
    pub fn test_host() -> (std::path::PathBuf, Arc<cogno_host::local_host::LocalHost>) {
        let endpoint = std::env::temp_dir()
            .join(format!(
                "cogno-connection-test-{}",
                uuid::Uuid::new_v4().simple()
            ))
            .join("host.json");
        let host = cogno_host::local_host::LocalHost::open(&endpoint, None).unwrap();
        (endpoint, Arc::new(host))
    }

    /// A connection to a host that stays for as long as the test runs.
    pub fn a_standing_connection() -> HostConnection {
        let (connection, host_side) = silent_host(Box::new(|_, _| {}));
        std::mem::forget(host_side);
        connection
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{silent_host, test_host, NoEvents};
    use super::*;
    use cogno_host::protocol::{HostErrorCode, StreamId, TerminalSize};
    use cogno_host::wire::{OLDEST_PROTOCOL_VERSION, PROTOCOL_VERSION};
    use std::time::Instant;

    use crate::command_error::ErrorCode;

    fn ignored() -> OnLost {
        Box::new(|_, _| {})
    }

    /// Notes how a connection ended, for `ending_of`.
    fn noted(ended: &Arc<Mutex<Option<Ending>>>) -> OnLost {
        let ended = ended.clone();
        Box::new(move |_, ending| *lock(&ended) = Some(ending))
    }

    /// Waits until `ended` holds how the connection ended.
    fn ending_of(ended: &Mutex<Option<Ending>>) -> Ending {
        let started = Instant::now();
        loop {
            if let Some(ending) = *lock(ended) {
                return ending;
            }
            assert!(started.elapsed() < Duration::from_secs(5));
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    /// A host of this test's own, and a connection to it.
    fn connected(on_lost: OnLost) -> HostConnection {
        let (endpoint, host) = test_host();
        // For as long as the test runs.
        std::mem::forget(host);
        let stream = cogno_host::local_host::connect(&endpoint).unwrap();
        HostConnection::to_this_machine(stream, Arc::new(NoEvents), on_lost).unwrap()
    }

    #[test]
    fn a_request_gets_the_reply_with_its_id() {
        let host = connected(ignored());
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
            stream: StreamId(1),
            seq: 0,
        })
        .unwrap();
        let acknowledged = host.request(Request::PtyAck {
            terminal_id: "nobody".into(),
            stream: StreamId(1),
            seq: 1,
        });
        assert!(matches!(acknowledged, Ok(Response::Done)));
    }

    #[test]
    fn hanging_up_ends_the_connection_at_once_and_says_so() {
        let ended = Arc::new(Mutex::new(None));
        // Held elsewhere too, as a request on its way holds it.
        let host = Arc::new(connected(noted(&ended)));
        let _also_held = host.clone();

        host.hang_up();

        assert_eq!(ending_of(&ended), Ending::HungUp);
        assert!(host
            .request(Request::ListShells)
            .unwrap_err()
            .is(AppErrorCode::ConnectionLost));
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
            Some("office"),
            Arc::new(NoEvents),
            ignored(),
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
            Some("office"),
            Arc::new(NoEvents),
            ignored(),
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
    fn a_host_that_does_not_answer_in_time_is_waited_for_no_longer() {
        let (host, _host_side) = silent_host(ignored());

        let answer = host.request_within(Request::TerminalProcesses, Duration::from_millis(100));

        assert!(answer.is_none());
    }

    #[test]
    fn a_lost_connection_fails_what_waits_and_is_reported_once() {
        let ended = Arc::new(Mutex::new(None));
        let (host, host_side) = silent_host(noted(&ended));

        // The host never answers and then goes away.
        let goes_away = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            drop(host_side);
        });
        let reply = host.request(Request::ListShells);
        assert!(reply.unwrap_err().is(AppErrorCode::ConnectionLost));
        goes_away.join().unwrap();

        assert_eq!(ending_of(&ended), Ending::Lost);
        assert!(host
            .request(Request::ListShells)
            .unwrap_err()
            .is(AppErrorCode::ConnectionLost));
    }
}
