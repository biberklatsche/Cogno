//! For a process that has one thing to tell this machine's host, or one
//! question to ask through it, and nothing else to do with it: an agent's
//! hook, `cogno action run` typed in a terminal, the askpass helper git and
//! ssh start. Without a Cogno that runs there is nobody to tell.

use std::io::{self, Read};
use std::net::{Shutdown, TcpStream};
use std::path::Path;
use std::time::{Duration, Instant};

use crate::local_host;
use crate::protocol::{Addressee, HostError, HostErrorCode, Request, Response};
use crate::wire::{self, ClientHello, ClientMessage, HostMessage};

/// How long a post waits for the host to take it in before hanging up.
const POST_PATIENCE: Duration = Duration::from_secs(2);
/// How long the hellos, and writing what is posted or asked, may take: a
/// host that stalls must not hold up an agent's hook or a prompt.
const EXCHANGE_PATIENCE: Duration = Duration::from_secs(2);
/// The id of the one request `ask` makes.
const QUESTION_ID: u64 = 1;

/// Tells the host `request`, which gets no answer (`Request::AgentHook`).
/// Fails only when the post did not go out: a host that is slow to close
/// its end has it all the same.
pub fn post(endpoint: &Path, request: Request) -> io::Result<()> {
    let mut stream = introduced(endpoint)?;
    wire::write_client_message(&mut stream, ClientMessage::Post { request })?;
    // Hung up only once the host has read the post and closed its end: a
    // socket closed with something unread may take the post down with it.
    stream.shutdown(Shutdown::Write)?;
    stream.set_read_timeout(Some(POST_PATIENCE))?;
    let mut rest = [0u8; 1024];
    loop {
        match stream.read(&mut rest) {
            Ok(0) => return Ok(()),
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            // Sent, and waited for long enough.
            Err(error) if is_timeout(&error) => return Ok(()),
            Err(error) => return Err(error),
        }
    }
}

/// Why `ask` brought back no answer.
#[derive(Debug)]
pub enum AskError {
    /// No host took the question: nothing was asked.
    Unreached(io::Error),
    /// A host is there, but speaks no version this one does: nothing was
    /// asked either.
    Incompatible(io::Error),
    /// Asked, but no answer came - in time, or before the host hung up.
    /// The one asked may have acted on it all the same.
    Unanswered(io::Error),
    /// The host refused it (`NoAddressee`, `NoAnswer`).
    Refused(HostError),
}

impl std::fmt::Display for AskError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AskError::Unreached(error) => write!(formatter, "no Cogno host took it: {error}"),
            AskError::Incompatible(error) => write!(formatter, "{error}"),
            AskError::Unanswered(error) => write!(formatter, "no answer came: {error}"),
            AskError::Refused(error) => formatter.write_str(&error.message),
        }
    }
}

/// Asks `question` - JSON text the host passes on unread - of the client
/// `to` names, through the host, and waits for its answer until
/// `deadline` (`None`: as long as it takes, for a prompt the user answers).
pub fn ask(
    endpoint: &Path,
    to: Addressee,
    question: String,
    deadline: Option<Instant>,
) -> Result<String, AskError> {
    let mut stream = introduced(endpoint).map_err(|error| {
        if error.kind() == io::ErrorKind::Unsupported {
            AskError::Incompatible(error)
        } else {
            AskError::Unreached(error)
        }
    })?;
    wire::write_client_message(
        &mut stream,
        ClientMessage::Request {
            id: QUESTION_ID,
            request: Request::Ask { to, question },
        },
    )
    .map_err(AskError::Unreached)?;
    match answer_within(&mut stream, deadline).map_err(AskError::Unanswered)? {
        Ok(Response::Answered { answer }) => Ok(answer),
        Ok(_) => Err(AskError::Refused(HostError::new(
            HostErrorCode::Unknown,
            "The host answered something else",
        ))),
        Err(error) => Err(AskError::Refused(error)),
    }
}

/// The reply to the question, read past whatever else the host sends.
fn answer_within(
    stream: &mut TcpStream,
    deadline: Option<Instant>,
) -> io::Result<Result<Response, HostError>> {
    loop {
        // Without a deadline, as long as the one asked takes.
        let mut patience = None;
        if let Some(deadline) = deadline {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "no answer came in time",
                ));
            }
            patience = Some(left);
        }
        stream.set_read_timeout(patience)?;
        match wire::read_host_message(stream)? {
            Some(HostMessage::Reply { id, reply }) if id == QUESTION_ID => return Ok(reply),
            Some(_) => continue,
            None => {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "the Cogno host hung up before the answer came",
                ))
            }
        }
    }
}

/// Whether a read gave up because its timeout ran out: `WouldBlock` on
/// Unix, `TimedOut` on Windows.
fn is_timeout(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
    )
}

/// A connection to the host `endpoint` names that has exchanged hellos.
pub(crate) fn introduced(endpoint: &Path) -> io::Result<TcpStream> {
    let stream = local_host::connect(endpoint)?;
    stream.set_read_timeout(Some(EXCHANGE_PATIENCE))?;
    stream.set_write_timeout(Some(EXCHANGE_PATIENCE))?;
    wire::introduce(
        &mut &stream,
        &mut &stream,
        &ClientHello::of_this_build(None),
    )?;
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::test_support::{spawn_request, WAITING};
    use crate::protocol::{AgentHook, Event, RelayId};
    use std::path::PathBuf;

    /// A host of this test's own, behind its endpoint file, for as long as
    /// the test runs.
    fn host() -> PathBuf {
        let (endpoint, host) = local_host::test_support::open();
        std::mem::forget(host);
        endpoint
    }

    /// A Cogno connected to it, as the app is.
    fn cogno(endpoint: &Path) -> TcpStream {
        let stream = introduced(endpoint).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        stream
    }

    fn next_event(stream: &mut TcpStream) -> Event {
        loop {
            if let Some(HostMessage::Event(event)) = wire::read_host_message(stream).unwrap() {
                return event;
            }
        }
    }

    /// Sends `request` and waits for its reply: requests of one client are
    /// taken in order, so what it posted before is in once this returns.
    fn request(stream: &mut TcpStream, id: u64, request: Request) {
        local_host::test_support::ask(stream, id, request).unwrap();
    }

    #[test]
    fn a_hook_reaches_the_cogno_that_shows_its_terminal() {
        let endpoint = host();
        let mut app = cogno(&endpoint);
        request(&mut app, 1, spawn_request("t1", 1, WAITING));
        let hook = AgentHook::of(Some("t1"), "Stop");

        post(&endpoint, Request::AgentHook { hook: hook.clone() }).unwrap();

        match next_event(&mut app) {
            Event::AgentHook {
                hook: got,
                replayed,
            } => {
                assert_eq!(got, hook);
                assert!(!replayed);
            }
            other => panic!("not the hook: {other:?}"),
        }
        request(
            &mut app,
            2,
            Request::PtyKill {
                terminal_id: "t1".into(),
            },
        );
    }

    #[test]
    fn a_question_is_answered_by_the_cogno_it_went_to() {
        let endpoint = host();
        let mut app = cogno(&endpoint);
        request(
            &mut app,
            1,
            Request::OwnPrompts {
                session: "git-1".into(),
            },
        );
        let answering = std::thread::spawn(move || {
            let Event::Asked {
                relay,
                to,
                question,
            } = next_event(&mut app)
            else {
                panic!("no question came");
            };
            assert_eq!(
                to,
                Addressee::PromptSession {
                    session: "git-1".into()
                }
            );
            assert_eq!(question, r#"{"prompt":"Password:"}"#);
            wire::write_client_message(
                &mut app,
                ClientMessage::Post {
                    request: Request::Answer {
                        relay,
                        answer: r#""secret""#.into(),
                    },
                },
            )
            .unwrap();
            relay
        });
        let answer = ask(
            &endpoint,
            Addressee::PromptSession {
                session: "git-1".into(),
            },
            r#"{"prompt":"Password:"}"#.into(),
            Some(Instant::now() + Duration::from_secs(10)),
        )
        .unwrap();

        assert_eq!(answer, r#""secret""#);
        assert_eq!(answering.join().unwrap(), RelayId(1));
    }

    #[test]
    fn a_question_nobody_answers_is_refused_with_its_code() {
        let endpoint = host();
        let _app = cogno(&endpoint);

        let answer = ask(
            &endpoint,
            Addressee::Terminal {
                terminal_id: "nowhere".into(),
            },
            "{}".into(),
            Some(Instant::now() + Duration::from_secs(10)),
        );

        assert!(
            matches!(answer, Err(AskError::Refused(error)) if error.code == HostErrorCode::NoAddressee)
        );
    }

    #[test]
    fn a_question_without_a_host_was_never_asked() {
        let endpoint = std::env::temp_dir().join("cogno-once-test-nobody-asked.json");
        let answer = ask(
            &endpoint,
            Addressee::Terminal {
                terminal_id: "t1".into(),
            },
            "{}".into(),
            None,
        );
        assert!(matches!(answer, Err(AskError::Unreached(_))));
    }

    #[test]
    fn a_question_no_answer_comes_for_in_time_is_unanswered() {
        let endpoint = host();
        // Owns the session, and leaves the question lying.
        let mut app = cogno(&endpoint);
        request(
            &mut app,
            1,
            Request::OwnPrompts {
                session: "git-2".into(),
            },
        );

        let answer = ask(
            &endpoint,
            Addressee::PromptSession {
                session: "git-2".into(),
            },
            "{}".into(),
            Some(Instant::now() + Duration::from_millis(300)),
        );
        assert!(matches!(answer, Err(AskError::Unanswered(_))));
    }

    #[test]
    fn a_host_that_stalls_holds_up_no_hook() {
        let endpoint = local_host::test_support::endpoint_of_a_stalled_host();
        let hook = AgentHook::of(None, "Stop");

        let started = Instant::now();
        assert!(post(&endpoint, Request::AgentHook { hook }).is_err());
        assert!(started.elapsed() < EXCHANGE_PATIENCE * 3);
        let _ = std::fs::remove_file(&endpoint);
    }

    #[test]
    fn without_a_host_there_is_nobody_to_tell() {
        let endpoint = std::env::temp_dir().join("cogno-once-test-nobody.json");
        let hook = AgentHook::of(None, "Stop");
        assert!(post(&endpoint, Request::AgentHook { hook }).is_err());
    }

    #[test]
    fn a_post_returns_as_soon_as_the_host_has_read_it() {
        let endpoint = host();
        // Holds a session, so the host outlives the post's connection, and
        // runs a shell that could have inherited the post's socket.
        let mut app = cogno(&endpoint);
        request(&mut app, 1, spawn_request("t1", 1, WAITING));

        let started = std::time::Instant::now();
        assert!(post(&endpoint, Request::ListSessions).is_ok());
        assert!(started.elapsed() < POST_PATIENCE);
        request(
            &mut app,
            2,
            Request::PtyKill {
                terminal_id: "t1".into(),
            },
        );
    }
}
