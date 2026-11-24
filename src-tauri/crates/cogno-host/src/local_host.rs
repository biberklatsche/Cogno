//! This machine's host, as the app runs it (ARCHITECTURE.md 2.7.1): one per
//! user, living as long as the app. Whoever talks to it is one of its
//! clients - the app itself, the processes that have something to tell it,
//! and a Cogno on a paired machine that the app hands in.
//!
//! From this machine it is reached over TCP on the loopback interface. What
//! keeps other users out is the token in the endpoint file, which only its
//! owner can read: every connection begins with it.

use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, Shutdown, TcpListener, TcpStream};
use std::num::NonZeroU64;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::host::{ClientId, Host, Origin};
use crate::identity::cogno_home;
use crate::server::serve_client;
use crate::wire;

const ENDPOINT_FILE_NAME: &str = "host.json";
/// How long a connection to the host may take to come about.
const CONNECT_PATIENCE: Duration = Duration::from_millis(300);
/// How long the host may take to answer a connection that presented its
/// token. It answers from a thread of its own at once; one that does not
/// within this is taken for gone.
const ANSWER_PATIENCE: Duration = Duration::from_secs(2);
/// How often a partial answer is looked at again.
const ANSWER_POLL_INTERVAL: Duration = Duration::from_millis(5);
/// How long a connection may take to present its token.
const TOKEN_PATIENCE: Duration = Duration::from_secs(5);
const TOKEN_LEN: usize = 32;

/// How the host is reached. The token line and the host's preamble (`wire`)
/// come before any version is spoken.
#[derive(Debug, Serialize, Deserialize)]
struct Endpoint {
    port: u16,
    token: String,
}

/// Where the host of this user says how to reach it.
pub fn endpoint_path(dev_mode: bool) -> Result<PathBuf, String> {
    Ok(cogno_home(dev_mode)?.join(ENDPOINT_FILE_NAME))
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn read_endpoint(path: &Path) -> io::Result<Endpoint> {
    serde_json::from_slice(&std::fs::read(path)?).map_err(|error| invalid(&error.to_string()))
}

/// Writes the endpoint so that only its owner can read it. The file exists
/// with its final permissions before the token goes into it.
fn write_endpoint(path: &Path, endpoint: &Endpoint) -> io::Result<()> {
    if let Some(directory) = path.parent() {
        std::fs::create_dir_all(directory)?;
    }
    let _ = std::fs::remove_file(path);
    let mut file = crate::private_file::create(path)?;
    let content = serde_json::to_vec(endpoint).map_err(|error| invalid(&error.to_string()))?;
    file.write_all(&content)
}

/// Connects to the host the endpoint file names, if it answers. What comes
/// back is the stream of a host: its preamble first (`wire`).
pub fn connect(endpoint: &Path) -> io::Result<TcpStream> {
    reach(&read_endpoint(endpoint)?)
}

/// Connects to the host `endpoint` names and makes sure it is one: it takes
/// the token and begins as a host does, in time. A Cogno that crashed leaves
/// its file behind, another program may listen on its port by now, and one
/// that never says hello would keep the caller waiting. What the host said
/// stays in the stream for the caller to read.
fn reach(endpoint: &Endpoint) -> io::Result<TcpStream> {
    // A host on this machine answers at once. Without the limit, Windows
    // spends seconds on a port nobody listens on.
    let address = std::net::SocketAddr::from((Ipv4Addr::LOCALHOST, endpoint.port));
    let mut stream = TcpStream::connect_timeout(&address, CONNECT_PATIENCE)?;
    // What is typed must not wait for more to fill a packet.
    stream.set_nodelay(true)?;
    stream.set_write_timeout(Some(ANSWER_PATIENCE))?;
    stream.set_read_timeout(Some(ANSWER_PATIENCE))?;
    let answered = stream
        .write_all(format!("{}\n", endpoint.token).as_bytes())
        .and_then(|_| wait_for_preamble(&stream));
    stream.set_write_timeout(None)?;
    stream.set_read_timeout(None)?;
    answered.map(|_| stream)
}

/// Waits until the stream begins with the host's preamble, without taking
/// it out of the stream.
fn wait_for_preamble(stream: &TcpStream) -> io::Result<()> {
    let not_a_host = || invalid("what answers on the port is no Cogno host");
    let deadline = Instant::now() + ANSWER_PATIENCE;
    let mut begun = [0u8; wire::PREAMBLE.len()];
    loop {
        // Waits up to the read timeout for the first byte; returns at once
        // with what is there after that.
        let seen = stream.peek(&mut begun)?;
        if seen == 0 || !wire::PREAMBLE.starts_with(&begun[..seen]) {
            return Err(not_a_host());
        }
        if seen == begun.len() {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "the Cogno host did not finish its answer",
            ));
        }
        std::thread::sleep(ANSWER_POLL_INTERVAL);
    }
}

/// Whether the connection presents `token` as its first line.
fn presents_token(stream: &mut TcpStream, token: &str) -> bool {
    if stream.set_read_timeout(Some(TOKEN_PATIENCE)).is_err() {
        return false;
    }
    let mut presented = Vec::with_capacity(TOKEN_LEN + 1);
    let mut byte = [0u8; 1];
    while presented.len() <= TOKEN_LEN {
        match stream.read(&mut byte) {
            Ok(1) if byte[0] == b'\n' => break,
            Ok(1) => presented.push(byte[0]),
            _ => return false,
        }
    }
    stream.set_read_timeout(None).is_ok() && same_secret(&presented, token.as_bytes())
}

/// Whether `a` and `b` are equal, in a time that does not tell how much of
/// them is: a guess at the token learns nothing from how long it took.
fn same_secret(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |differ, (x, y)| differ | (x ^ y)) == 0
}

/// Client ids of one host, never used again.
#[derive(Clone)]
struct ClientIds(Arc<AtomicU64>);

impl ClientIds {
    fn next(&self) -> ClientId {
        ClientId(
            NonZeroU64::new(self.0.fetch_add(1, Ordering::Relaxed)).expect("client ids start at 1"),
        )
    }
}

/// This machine's host while the app runs.
pub struct LocalHost {
    host: Arc<Host>,
    clients: ClientIds,
    endpoint: PathBuf,
    token: String,
}

impl LocalHost {
    /// Opens the host of the Cogno home the endpoint file lies in and says in
    /// that file how this machine reaches it. A file a Cogno left behind that
    /// crashed is written over: the app runs once per user, so nobody else
    /// answers behind it. Its shells write their start-up logs to
    /// `bootstrap_log_dir`, if one is given.
    pub fn open(endpoint: &Path, bootstrap_log_dir: Option<PathBuf>) -> io::Result<Self> {
        let home = endpoint
            .parent()
            .ok_or_else(|| invalid("the endpoint file lies in no directory"))?
            .to_path_buf();
        // The user's login-shell environment, captured in the background so
        // the first shell does not pay for it.
        crate::login_environment::prefetch_login_environment();
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
        let port = listener.local_addr()?.port();
        let token = uuid::Uuid::new_v4().simple().to_string();
        write_endpoint(
            endpoint,
            &Endpoint {
                port,
                token: token.clone(),
            },
        )?;
        let host = Arc::new(Host::new(home, endpoint.to_path_buf(), bootstrap_log_dir));
        let clients = ClientIds(Arc::new(AtomicU64::new(1)));
        {
            let host = host.clone();
            let clients = clients.clone();
            let token = token.clone();
            std::thread::spawn(move || {
                for stream in listener.incoming() {
                    let Ok(stream) = stream else { continue };
                    let host = host.clone();
                    let client = clients.next();
                    let token = token.clone();
                    std::thread::spawn(move || serve_this_machine(&host, client, stream, &token));
                }
            });
        }
        Ok(Self {
            host,
            clients,
            endpoint: endpoint.to_path_buf(),
            token,
        })
    }

    /// Serves a Cogno on another machine over the two streams until it hangs
    /// up: a client that borrows sessions and starts none. Blocks.
    pub fn serve_other_machine(
        &self,
        input: impl Read,
        output: impl Write + Send + 'static,
    ) -> io::Result<()> {
        serve_client(
            &self.host,
            self.clients.next(),
            Origin::OtherMachine,
            input,
            output,
        )
    }

    /// Ends every shell and takes the endpoint file along: the app ends.
    pub fn close(&self) {
        // Still this host's: a Cogno of another build never writes it.
        if read_endpoint(&self.endpoint).is_ok_and(|written| written.token == self.token) {
            let _ = std::fs::remove_file(&self.endpoint);
        }
        self.host.shut_down_all();
    }
}

/// Serves one connection from this machine, once it presented the token.
fn serve_this_machine(host: &Arc<Host>, client: ClientId, mut stream: TcpStream, token: &str) {
    if !presents_token(&mut stream, token) || stream.set_nodelay(true).is_err() {
        let _ = stream.shutdown(Shutdown::Both);
        return;
    }
    if let Ok(input) = stream.try_clone() {
        let _ = serve_client(host, client, Origin::ThisMachine, input, stream);
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use crate::protocol::{HostError, Request, Response};
    use crate::wire::{ClientMessage, HostMessage};

    fn endpoint_file() -> PathBuf {
        std::env::temp_dir()
            .join(format!("cogno-host-test-{}", uuid::Uuid::new_v4().simple()))
            .join("host.json")
    }

    /// A host of this test's own, and the endpoint file it wrote.
    pub(crate) fn open() -> (PathBuf, LocalHost) {
        let endpoint = endpoint_file();
        let host = LocalHost::open(&endpoint, None).unwrap();
        (endpoint, host)
    }

    /// An endpoint file whose port belongs to a program that takes
    /// connections and never answers.
    pub(crate) fn endpoint_of_a_silent_program() -> (PathBuf, TcpListener) {
        let silent = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let endpoint = endpoint_file();
        write_endpoint(
            &endpoint,
            &Endpoint {
                port: silent.local_addr().unwrap().port(),
                token: "a".repeat(TOKEN_LEN),
            },
        )
        .unwrap();
        (endpoint, silent)
    }

    /// An endpoint file of a program that begins as a host does and then says
    /// nothing more, for as long as the test runs.
    pub(crate) fn endpoint_of_a_stalled_host() -> PathBuf {
        let (file, listener) = endpoint_of_a_silent_program();
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.write_all(wire::PREAMBLE).unwrap();
            std::thread::sleep(Duration::from_secs(30));
        });
        file
    }

    /// Asks `request` under `id` and waits for its reply, past events.
    pub(crate) fn ask(
        stream: &mut (impl Read + Write),
        id: u64,
        request: Request,
    ) -> Result<Response, HostError> {
        wire::write_client_message(stream, ClientMessage::Request { id, request }).unwrap();
        loop {
            if let Some(HostMessage::Reply { id: replied, reply }) =
                wire::read_host_message(stream).unwrap()
            {
                if replied == id {
                    return reply;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{ask, endpoint_of_a_silent_program, open};
    use super::*;
    use crate::host::test_support::{spawn_request, WAITING};
    use crate::protocol::{HostErrorCode, Request, Response};
    use crate::wire::{ClientHello, HostMessage};

    /// A connection that has exchanged hellos with the host.
    fn client(endpoint: &Path) -> TcpStream {
        crate::once::introduced(endpoint).unwrap()
    }

    #[test]
    fn two_clients_reach_the_same_host() {
        let (endpoint, _host) = open();
        let mut first = client(&endpoint);
        let mut second = client(&endpoint);

        assert!(matches!(
            ask(&mut first, 1, spawn_request("t1", 1, WAITING)),
            Ok(Response::Spawned { .. })
        ));
        assert!(matches!(
            ask(&mut second, 1, Request::ListSessions),
            Ok(Response::Sessions { sessions }) if sessions.len() == 1
        ));
    }

    #[test]
    fn a_connection_without_the_token_gets_nothing() {
        let (endpoint, _host) = open();
        let Endpoint { port, .. } = read_endpoint(&endpoint).unwrap();

        let mut stranger = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        stranger.write_all(b"not-the-token\n").unwrap();
        let mut answer = Vec::new();
        // Closed without a byte, not even the hello.
        assert_eq!(stranger.read_to_end(&mut answer).unwrap_or(0), 0);

        // And the host still serves the next one.
        drop(client(&endpoint));
    }

    #[test]
    fn a_cogno_on_another_machine_sees_the_shells_and_starts_none() {
        let (endpoint, host) = open();
        let mut app = client(&endpoint);
        assert!(matches!(
            ask(&mut app, 1, spawn_request("t1", 1, WAITING)),
            Ok(Response::Spawned { .. })
        ));
        // The two pipes the stream of a paired machine would be.
        let (input, mut to_host) = io::pipe().unwrap();
        let (mut from_host, output) = io::pipe().unwrap();
        let served = std::thread::spawn(move || host.serve_other_machine(input, output));
        let hello = ClientHello::of_this_build(Some("laptop".to_string()));
        wire::introduce(&mut from_host, &mut to_host, &hello).unwrap();
        let mut laptop = Paired {
            from_host,
            to_host: Some(to_host),
        };

        assert!(matches!(
            ask(&mut laptop, 1, Request::ListSessions),
            Ok(Response::Sessions { sessions }) if sessions.len() == 1
        ));
        let refused = ask(&mut laptop, 2, spawn_request("t2", 1, WAITING));
        assert_eq!(refused.unwrap_err().code, HostErrorCode::InvalidRequest);

        // The other machine hangs up: serving it ends, the shell runs on.
        laptop.to_host = None;
        assert!(served.join().unwrap().is_ok());
        assert!(matches!(
            ask(&mut app, 2, Request::ListSessions),
            Ok(Response::Sessions { sessions }) if sessions.len() == 1
        ));
    }

    /// Both directions of a paired machine's stream, as one.
    struct Paired {
        from_host: io::PipeReader,
        to_host: Option<io::PipeWriter>,
    }

    impl Read for Paired {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            self.from_host.read(buffer)
        }
    }

    impl Write for Paired {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            self.to_host.as_mut().expect("not hung up").write(bytes)
        }

        fn flush(&mut self) -> io::Result<()> {
            self.to_host.as_mut().expect("not hung up").flush()
        }
    }

    #[test]
    fn a_program_that_does_not_answer_like_a_host_is_none() {
        let (endpoint, _silent) = endpoint_of_a_silent_program();

        let started = Instant::now();
        assert!(connect(&endpoint).is_err());
        // Given up in time, not waited for for ever.
        assert!(started.elapsed() < ANSWER_PATIENCE * 2);

        // A Cogno that starts writes over what the other one left.
        let _host = LocalHost::open(&endpoint, None).unwrap();
        drop(client(&endpoint));
    }

    #[test]
    fn closing_takes_the_endpoint_file_along() {
        let (endpoint, host) = open();

        host.close();

        assert!(!endpoint.exists());
    }

    #[test]
    fn a_secret_is_the_same_only_byte_for_byte() {
        assert!(same_secret(b"abc", b"abc"));
        assert!(!same_secret(b"abc", b"abd"));
        assert!(!same_secret(b"abc", b"abcd"));
    }

    #[test]
    fn a_host_that_answers_bit_by_bit_is_waited_for() {
        let (file, listener) = endpoint_of_a_silent_program();
        let endpoint = read_endpoint(&file).unwrap();
        let _ = std::fs::remove_file(&file);
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let (first, rest) = wire::PREAMBLE.split_at(3);
            stream.write_all(first).unwrap();
            std::thread::sleep(ANSWER_POLL_INTERVAL * 4);
            stream.write_all(rest).unwrap();
            std::thread::sleep(Duration::from_secs(1));
        });

        assert!(reach(&endpoint).is_ok());
    }

    #[test]
    fn a_request_of_a_later_client_fails_alone_and_the_connection_goes_on() {
        let (endpoint, _host) = open();
        let mut stream = client(&endpoint);
        // A spawn with a shell type this build does not know, framed by hand.
        let body = br#"{"type":"request","id":5,"request":{"type":"ptySpawn","options":{"terminal_id":"t1","size":{"cols":80,"rows":24},"profile":{"shell_type":"Fish"},"integration_version":"9"},"window":"main","stream":1,"env":[]}}"#;
        let mut frame = (body.len() as u32).to_le_bytes().to_vec();
        frame.push(1);
        frame.extend_from_slice(body);
        stream.write_all(&frame).unwrap();

        loop {
            if let Some(HostMessage::Reply { id, reply }) =
                wire::read_host_message(&mut stream).unwrap()
            {
                assert_eq!(id, 5);
                assert_eq!(reply.unwrap_err().code, HostErrorCode::InvalidRequest);
                break;
            }
        }
        assert!(matches!(
            ask(&mut stream, 6, Request::ListSessions),
            Ok(Response::Sessions { .. })
        ));
    }

    #[test]
    fn the_endpoint_file_is_its_owners_alone() {
        let (endpoint, _host) = open();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&endpoint).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        #[cfg(windows)]
        {
            let listed = std::process::Command::new("icacls")
                .arg(&endpoint)
                .output()
                .unwrap();
            let listed = String::from_utf8_lossy(&listed.stdout).to_string();
            // One entry, for the owner rights, and nothing inherited (I).
            let entries: Vec<&str> = listed.lines().filter(|line| line.contains(":(")).collect();
            assert_eq!(entries.len(), 1, "{listed}");
            assert!(!entries[0].contains("(I)"), "{listed}");
        }
    }
}
