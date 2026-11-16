//! For a process that has one thing to tell this machine's daemon, or one
//! question to ask through it, and nothing else to do with it: an agent's
//! hook, `cogno action run` typed in a terminal, the askpass helper git and
//! ssh start. Neither starts a daemon: without one there is nobody to tell.

use std::io::{self, Read};
use std::net::{Shutdown, TcpStream};
use std::path::Path;
use std::time::Duration;

use crate::daemon;
use crate::protocol::{Answer, HostError, HostErrorCode, Question, Request, Response};
use crate::wire::{self, ClientHello, ClientMessage, HostMessage};

/// How long a post waits for the daemon to take it in before hanging up.
const POST_PATIENCE: Duration = Duration::from_secs(2);
/// The id of the one request `ask` makes.
const QUESTION_ID: u64 = 1;

/// Tells the daemon `request`, which gets no answer (`Request::AgentHook`).
pub fn post(endpoint: &Path, request: Request) -> io::Result<()> {
    let mut stream = introduced(endpoint)?;
    wire::write_client_message(&mut stream, ClientMessage::Post { request })?;
    // Hung up only once the daemon has read the post and closed its end: a
    // socket closed with something unread may take the post down with it.
    stream.shutdown(Shutdown::Write)?;
    stream.set_read_timeout(Some(POST_PATIENCE))?;
    let mut rest = [0u8; 1024];
    while stream.read(&mut rest)? > 0 {}
    Ok(())
}

/// Asks `question` through the daemon and waits for the answer of the
/// client it went to, for `patience` between messages at most (`None`: as
/// long as it takes, for a prompt the user answers). The daemon's own
/// refusal (`NotShown`, `NoAnswer`) is the inner error.
pub fn ask(
    endpoint: &Path,
    question: Question,
    patience: Option<Duration>,
) -> io::Result<Result<Answer, HostError>> {
    let mut stream = introduced(endpoint)?;
    stream.set_read_timeout(patience)?;
    wire::write_client_message(
        &mut stream,
        ClientMessage::Request {
            id: QUESTION_ID,
            request: Request::Ask { question },
        },
    )?;
    loop {
        match wire::read_host_message(&mut stream)? {
            Some(HostMessage::Reply { id, reply }) if id == QUESTION_ID => {
                return Ok(match reply {
                    Ok(Response::Answered { answer }) => Ok(answer),
                    Ok(_) => Err(HostError::new(
                        HostErrorCode::Unknown,
                        "The host answered something else",
                    )),
                    Err(error) => Err(error),
                });
            }
            // Events and output are for clients that show something.
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

/// A connection to the daemon `endpoint` names that has exchanged hellos.
fn introduced(endpoint: &Path) -> io::Result<TcpStream> {
    let mut stream = daemon::connect(endpoint)?;
    wire::skip_to_preamble(&mut stream)?;
    let hello = wire::read_host_hello(&mut stream)?;
    if wire::check_versions(hello.protocol, hello.oldest).is_err() {
        return Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "the Cogno host speaks no protocol version this cogno does",
        ));
    }
    wire::write_client_hello(&mut stream, &ClientHello::of_this_build(None))?;
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::daemon::{run, Patience};
    use crate::protocol::{AgentHook, Event, RelayId};
    use std::path::PathBuf;
    use std::time::Instant;

    /// A daemon of this test's own, behind its endpoint file.
    fn daemon() -> PathBuf {
        let endpoint = std::env::temp_dir().join(format!(
            "cogno-once-test-{}.json",
            uuid::Uuid::new_v4().simple()
        ));
        {
            let endpoint = endpoint.clone();
            std::thread::spawn(move || {
                run(
                    &endpoint,
                    Patience {
                        for_the_first_client: Duration::from_secs(10),
                        when_idle: Duration::from_secs(2),
                    },
                )
            });
        }
        let started = Instant::now();
        while daemon::connect(&endpoint).is_err() {
            assert!(started.elapsed() < Duration::from_secs(10));
            std::thread::sleep(Duration::from_millis(20));
        }
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

    #[test]
    fn a_hook_without_a_terminal_reaches_the_cognos_connected() {
        let endpoint = daemon();
        let mut app = cogno(&endpoint);
        let hook = AgentHook {
            terminal_id: None,
            provider: "opencode".into(),
            event: "session.idle".into(),
            sent_at: 5,
            payload: "{}".into(),
        };

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
    }

    #[test]
    fn a_question_is_answered_by_the_cogno_it_went_to() {
        let endpoint = daemon();
        let mut app = cogno(&endpoint);
        wire::write_client_message(
            &mut app,
            ClientMessage::Post {
                request: Request::OwnPrompts {
                    session: "git-1".into(),
                },
            },
        )
        .unwrap();
        // Requests of one client are taken in order: once this one is
        // answered, the post before it is in.
        wire::write_client_message(
            &mut app,
            ClientMessage::Request {
                id: 1,
                request: Request::ListSessions,
            },
        )
        .unwrap();
        while !matches!(
            wire::read_host_message(&mut app).unwrap(),
            Some(HostMessage::Reply { id: 1, .. })
        ) {}
        let answering = std::thread::spawn(move || {
            let Event::Asked { relay, question } = next_event(&mut app) else {
                panic!("no question came");
            };
            assert!(matches!(question, Question::Prompt { .. }));
            wire::write_client_message(
                &mut app,
                ClientMessage::Post {
                    request: Request::Answer {
                        relay,
                        answer: Answer::Prompt {
                            answer: Some("secret".into()),
                        },
                    },
                },
            )
            .unwrap();
            relay
        });
        let answer = ask(
            &endpoint,
            Question::Prompt {
                session: "git-1".into(),
                token: "k".into(),
                prompt: "Password:".into(),
            },
            Some(Duration::from_secs(10)),
        )
        .unwrap();

        assert_eq!(
            answer,
            Ok(Answer::Prompt {
                answer: Some("secret".into())
            })
        );
        assert_eq!(answering.join().unwrap(), RelayId(1));
    }

    #[test]
    fn a_question_nobody_answers_is_refused_with_its_code() {
        let endpoint = daemon();
        let _app = cogno(&endpoint);

        let answer = ask(
            &endpoint,
            Question::RunAction {
                terminal_id: "nowhere".into(),
                name: "new_tab".into(),
                args: vec![],
            },
            Some(Duration::from_secs(10)),
        )
        .unwrap();

        assert_eq!(answer.unwrap_err().code, HostErrorCode::NotShown);
    }

    #[test]
    fn without_a_daemon_there_is_nobody_to_tell() {
        let endpoint = std::env::temp_dir().join("cogno-once-test-nobody.json");
        let hook = AgentHook {
            terminal_id: None,
            provider: "codex".into(),
            event: "Stop".into(),
            sent_at: 0,
            payload: "{}".into(),
        };
        assert!(post(&endpoint, Request::AgentHook { hook }).is_err());
    }
}
