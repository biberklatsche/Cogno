//! The host as a process of its own: one per user and machine, behind a
//! connection only that user can make. Its sessions belong to no window and
//! no connection, so a Cogno can go away and another one - on this machine
//! or, through ssh, on another - can come and go on with them.
//!
//! The connection is TCP on the loopback interface. What keeps other users
//! out is the token in the endpoint file, which only its owner can read:
//! every connection begins with it.

use std::io::{self, Read, Write};
use std::net::{Ipv4Addr, Shutdown, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::host::Host;
use crate::identity::{DEVELOPMENT_HOME_DIRECTORY_NAME, HOME_DIRECTORY_NAME};
use crate::server::serve_client;

const ENDPOINT_FILE_NAME: &str = "host.json";
/// How long a connection to the daemon may take to come about.
const CONNECT_PATIENCE: Duration = Duration::from_millis(300);
/// How long a connection may take to present its token.
const TOKEN_PATIENCE: Duration = Duration::from_secs(5);
const TOKEN_LEN: usize = 32;

#[derive(Debug, Serialize, Deserialize)]
struct Endpoint {
    port: u16,
    token: String,
}

/// How long a daemon waits before it ends itself.
#[derive(Clone, Copy)]
pub struct Patience {
    /// For its first client, after it started.
    pub for_the_first_client: Duration,
    /// With no client and no session left.
    pub when_idle: Duration,
}

impl Default for Patience {
    fn default() -> Self {
        Self {
            for_the_first_client: Duration::from_secs(30),
            when_idle: Duration::from_secs(3),
        }
    }
}

/// Where the daemon of this user says how to reach it.
pub fn endpoint_path(dev_mode: bool) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let directory = if dev_mode {
        DEVELOPMENT_HOME_DIRECTORY_NAME
    } else {
        HOME_DIRECTORY_NAME
    };
    Ok(home.join(directory).join(ENDPOINT_FILE_NAME))
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
    let mut file = create_private(path)?;
    let content = serde_json::to_vec(endpoint).map_err(|error| invalid(&error.to_string()))?;
    file.write_all(&content)
}

#[cfg(unix)]
fn create_private(path: &Path) -> io::Result<std::fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}

/// On Windows a new file takes the permissions of its directory, and a
/// profile may let others read. The file gets a list of its own instead:
/// full access for its owner, nobody else, nothing inherited.
#[cfg(windows)]
fn create_private(path: &Path) -> io::Result<std::fs::File> {
    use std::os::windows::ffi::OsStrExt;
    use winapi::shared::sddl::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use winapi::um::securitybaseapi::SetFileSecurityW;
    use winapi::um::winbase::LocalFree;
    use winapi::um::winnt::{DACL_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION};

    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    let wide = |text: &std::ffi::OsStr| -> Vec<u16> { text.encode_wide().chain([0]).collect() };
    // D: a permission list; P: nothing inherited; one entry: allow (A) all
    // file access (FA) to the owner (OW).
    let owner_only = wide(std::ffi::OsStr::new("D:P(A;;FA;;;OW)"));
    let mut descriptor = std::ptr::null_mut();
    // SAFETY: both strings are NUL-terminated; `descriptor` is allocated by
    // the call and freed below.
    let applied = unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            owner_only.as_ptr(),
            SDDL_REVISION_1 as u32,
            &mut descriptor,
            std::ptr::null_mut(),
        ) != 0
            && SetFileSecurityW(
                wide(path.as_os_str()).as_ptr(),
                DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                descriptor,
            ) != 0
    };
    let failure = io::Error::last_os_error();
    if !descriptor.is_null() {
        // SAFETY: allocated by the conversion above.
        unsafe { LocalFree(descriptor.cast()) };
    }
    if !applied {
        drop(file);
        let _ = std::fs::remove_file(path);
        return Err(failure);
    }
    Ok(file)
}

/// Connects to the daemon the endpoint file names. What comes back is the
/// stream of a host: its preamble first (`wire`).
pub fn connect(endpoint: &Path) -> io::Result<TcpStream> {
    let Endpoint { port, token } = read_endpoint(endpoint)?;
    // A daemon on this machine answers at once. Without the limit, Windows
    // spends seconds on a port nobody listens on - the port of a daemon
    // that was killed and left its endpoint file behind.
    let address = std::net::SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let mut stream = TcpStream::connect_timeout(&address, CONNECT_PATIENCE)?;
    // What is typed must not wait for more to fill a packet.
    stream.set_nodelay(true)?;
    stream.write_all(format!("{token}\n").as_bytes())?;
    Ok(stream)
}

/// Passes bytes between the two streams and the daemon the endpoint file
/// names, until either side ends: what `cogno server --stdio` is, started
/// through ssh by a Cogno on another machine. The daemon cannot tell such a
/// client from one on this machine.
pub fn bridge(
    endpoint: &Path,
    mut input: impl Read + Send + 'static,
    mut output: impl Write,
) -> io::Result<()> {
    let mut from_daemon = connect(endpoint)?;
    let mut to_daemon = from_daemon.try_clone()?;
    std::thread::spawn(move || {
        let _ = pass(&mut input, &mut to_daemon);
        // The client hung up: the daemon learns it by its input ending.
        let _ = to_daemon.shutdown(Shutdown::Write);
    });
    pass(&mut from_daemon, &mut output)
}

/// Copies until `from` ends, handing on every read at once: what is typed
/// and what is printed must not wait in a buffer.
fn pass(from: &mut impl Read, to: &mut impl Write) -> io::Result<()> {
    let mut buffer = [0u8; 16 * 1024];
    loop {
        match from.read(&mut buffer) {
            Ok(0) => return Ok(()),
            Ok(read) => {
                to.write_all(&buffer[..read])?;
                to.flush()?;
            }
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            // The other side went away. Depending on the system and on what
            // was still unread, that shows as an end or as one of these.
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::ConnectionReset
                        | io::ErrorKind::ConnectionAborted
                        | io::ErrorKind::BrokenPipe
                ) =>
            {
                return Ok(())
            }
            Err(error) => return Err(error),
        }
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
    stream.set_read_timeout(None).is_ok() && presented == token.as_bytes()
}

/// Runs the daemon until it has had no client and no session for a while,
/// then ends every shell that is left and returns. Fails at once when the
/// endpoint file already names a daemon that answers.
pub fn run(endpoint: &Path, patience: Patience) -> io::Result<()> {
    if connect(endpoint).is_ok() {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "a Cogno host already runs for this user",
        ));
    }
    // The user's login-shell environment, captured in the background so the
    // first shell does not pay for it.
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

    let host = Arc::new(Host::new());
    let clients = Arc::new(AtomicUsize::new(0));
    let had_a_client = Arc::new(AtomicBool::new(false));
    let ending = Arc::new(AtomicBool::new(false));
    {
        let host = host.clone();
        let clients = clients.clone();
        let had_a_client = had_a_client.clone();
        let ending = ending.clone();
        std::thread::spawn(move || {
            wait_until_idle(&host, &clients, &had_a_client, patience);
            ending.store(true, Ordering::Release);
            // Wakes the accept below.
            let _ = TcpStream::connect((Ipv4Addr::LOCALHOST, port));
        });
    }

    let next_client = AtomicU64::new(1);
    for stream in listener.incoming() {
        if ending.load(Ordering::Acquire) {
            break;
        }
        let Ok(mut stream) = stream else { continue };
        let client = next_client.fetch_add(1, Ordering::Relaxed);
        let host = host.clone();
        let clients = clients.clone();
        let had_a_client = had_a_client.clone();
        let token = token.clone();
        // Counted before its thread runs: a client that is on its way in
        // must keep the daemon from calling itself idle.
        clients.fetch_add(1, Ordering::AcqRel);
        std::thread::spawn(move || {
            if presents_token(&mut stream, &token) && stream.set_nodelay(true).is_ok() {
                // Noted here, not by the idle watch: it only looks now and
                // then and would miss a client that came and went between.
                had_a_client.store(true, Ordering::Release);
                if let Ok(input) = stream.try_clone() {
                    let _ = serve_client(&host, client, input, stream);
                }
            } else {
                let _ = stream.shutdown(Shutdown::Both);
            }
            clients.fetch_sub(1, Ordering::AcqRel);
        });
    }

    // Only this daemon's own file: another one may have started meanwhile.
    if read_endpoint(endpoint).is_ok_and(|current| current.token == token) {
        let _ = std::fs::remove_file(endpoint);
    }
    host.release_all();
    Ok(())
}

/// Returns once the daemon has nothing to do: no client came in time, or the
/// last one left and no session goes on without it.
fn wait_until_idle(
    host: &Host,
    clients: &AtomicUsize,
    had_a_client: &AtomicBool,
    patience: Patience,
) {
    const LOOK_EVERY: Duration = Duration::from_millis(100);
    let started = Instant::now();
    let mut idle_since: Option<Instant> = None;
    loop {
        std::thread::sleep(LOOK_EVERY);
        if clients.load(Ordering::Acquire) > 0 || host.session_count() > 0 {
            idle_since = None;
            continue;
        }
        if !had_a_client.load(Ordering::Acquire) {
            if started.elapsed() >= patience.for_the_first_client {
                return;
            }
            continue;
        }
        let since = *idle_since.get_or_insert_with(Instant::now);
        if since.elapsed() >= patience.when_idle {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Request, Response};
    use crate::wire::{self, HostMessage, RequestEnvelope};

    const QUICK: Patience = Patience {
        for_the_first_client: Duration::from_secs(10),
        when_idle: Duration::from_millis(300),
    };

    /// An endpoint file of this test's own, and the daemon behind it.
    fn start(patience: Patience) -> (PathBuf, std::thread::JoinHandle<io::Result<()>>) {
        let endpoint = std::env::temp_dir().join(format!(
            "cogno-daemon-test-{}.json",
            uuid::Uuid::new_v4().simple()
        ));
        let daemon = {
            let endpoint = endpoint.clone();
            std::thread::spawn(move || run(&endpoint, patience))
        };
        let started = Instant::now();
        while connect(&endpoint).is_err() {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "the daemon never answered"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        (endpoint, daemon)
    }

    /// A connection that has read the host's hello.
    fn client(endpoint: &Path) -> TcpStream {
        let mut stream = connect(endpoint).unwrap();
        wire::skip_to_preamble(&mut stream).unwrap();
        assert!(matches!(
            wire::read_host_message(&mut stream).unwrap(),
            Some(HostMessage::Hello { .. })
        ));
        stream
    }

    fn ask(stream: &mut TcpStream, id: u64, request: Request) -> Result<Response, String> {
        wire::write_request(stream, &RequestEnvelope { id, request }).unwrap();
        loop {
            if let Some(HostMessage::Reply { id: replied, reply }) =
                wire::read_host_message(stream).unwrap()
            {
                assert_eq!(replied, id);
                return reply;
            }
        }
    }

    fn finishes(daemon: std::thread::JoinHandle<io::Result<()>>) -> io::Result<()> {
        let started = Instant::now();
        while !daemon.is_finished() {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "the daemon is still running"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        daemon.join().unwrap()
    }

    #[test]
    fn two_clients_reach_the_same_host_and_it_ends_when_both_are_gone() {
        let (endpoint, daemon) = start(QUICK);
        let mut first = client(&endpoint);
        let mut second = client(&endpoint);

        assert!(matches!(
            ask(&mut first, 1, Request::ListSessions),
            Ok(Response::Sessions(sessions)) if sessions.is_empty()
        ));
        assert!(matches!(
            ask(&mut second, 1, Request::ListShells),
            Ok(Response::Shells(_))
        ));

        drop(first);
        drop(second);
        assert!(finishes(daemon).is_ok());
        // It took its endpoint along: nothing points at a daemon that is gone.
        assert!(!endpoint.exists());
    }

    #[test]
    fn a_connection_without_the_token_gets_nothing() {
        let (endpoint, daemon) = start(QUICK);
        let Endpoint { port, .. } = read_endpoint(&endpoint).unwrap();

        let mut stranger = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        stranger.write_all(b"not-the-token\n").unwrap();
        let mut answer = Vec::new();
        // Closed without a byte, not even the hello.
        assert_eq!(stranger.read_to_end(&mut answer).unwrap_or(0), 0);

        // The daemon had no real client yet and still serves the next one.
        drop(client(&endpoint));
        assert!(finishes(daemon).is_ok());
    }

    #[test]
    fn a_second_daemon_for_the_same_endpoint_refuses_to_start() {
        let (endpoint, daemon) = start(QUICK);
        let held = client(&endpoint);

        let second = run(&endpoint, QUICK);
        assert_eq!(second.unwrap_err().kind(), io::ErrorKind::AlreadyExists);
        // And left the first one's endpoint alone.
        assert!(connect(&endpoint).is_ok());

        drop(held);
        assert!(finishes(daemon).is_ok());
    }

    #[test]
    fn a_bridge_is_a_client_like_any_other_and_takes_its_end_to_the_daemon() {
        let (endpoint, daemon) = start(QUICK);
        // The two pipes ssh would be.
        let (bridge_input, mut to_bridge) = io::pipe().unwrap();
        let (mut from_bridge, bridge_output) = io::pipe().unwrap();
        let bridge = {
            let endpoint = endpoint.clone();
            std::thread::spawn(move || bridge(&endpoint, bridge_input, bridge_output))
        };

        wire::skip_to_preamble(&mut from_bridge).unwrap();
        assert!(matches!(
            wire::read_host_message(&mut from_bridge).unwrap(),
            Some(HostMessage::Hello { .. })
        ));
        wire::write_request(
            &mut to_bridge,
            &RequestEnvelope {
                id: 4,
                request: Request::ListSessions,
            },
        )
        .unwrap();
        assert!(matches!(
            wire::read_host_message(&mut from_bridge).unwrap(),
            Some(HostMessage::Reply {
                id: 4,
                reply: Ok(Response::Sessions(_))
            })
        ));

        // The other machine hangs up: the bridge ends, and so does a daemon
        // that has nobody else.
        drop(to_bridge);
        assert!(bridge.join().unwrap().is_ok());
        assert!(finishes(daemon).is_ok());
    }

    #[test]
    fn a_bridge_without_a_daemon_fails_at_once() {
        let nowhere = std::env::temp_dir().join("cogno-daemon-test-no-such-endpoint.json");
        assert!(bridge(&nowhere, io::empty(), io::sink()).is_err());
    }

    #[test]
    fn a_daemon_nobody_comes_to_ends_itself() {
        let endpoint = std::env::temp_dir().join(format!(
            "cogno-daemon-test-{}.json",
            uuid::Uuid::new_v4().simple()
        ));
        let impatient = Patience {
            for_the_first_client: Duration::from_millis(300),
            when_idle: Duration::from_millis(300),
        };

        assert!(run(&endpoint, impatient).is_ok());
        assert!(!endpoint.exists());
    }

    #[test]
    fn the_endpoint_file_is_its_owners_alone() {
        let (endpoint, daemon) = start(QUICK);

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

        drop(client(&endpoint));
        assert!(finishes(daemon).is_ok());
    }
}
