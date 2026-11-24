//! The host: answers what its clients ask (`protocol::Request`) and tells
//! them what happens (`protocol::Event`).

use std::num::NonZeroU64;
use std::path::PathBuf;
use std::sync::Arc;

use crate::attachment::Owner;
use crate::processes::{
    get_process_tree_snapshot, list_terminal_processes, terminate_process_tree,
};
use crate::protocol::{
    Addressee, AgentHook, Event, HostError, HostErrorCode, Reply, Request, Response,
};
use crate::relay::{no_addressee, Relay};
use crate::sessions::{Sessions, SpawnRequest, Spawned};
use crate::shared_session::Departure;
use crate::shell_integration;
use crate::shell_spawner::ShellSpawner;
use crate::shells::detect_shells;
use crate::wire::Output;

/// Where what a host tells one client goes.
pub trait EventSink: Send + Sync + 'static {
    fn event(&self, event: Event);
    /// What an agent's hook said, now. Unlike output it is not paced by the
    /// client's acknowledgements, and anyone on the machine can post hooks:
    /// a sink may drop it while the client is far behind.
    fn agent_hook(&self, hook: &AgentHook) {
        self.event(Event::AgentHook {
            hook: hook.clone(),
            replayed: false,
        });
    }
    /// The answer to the client's request `id`, when it comes later than the
    /// request: a question another client answered.
    fn reply(&self, id: u64, reply: Reply);
    /// A piece of a session's output. False when nobody takes it any more: a
    /// session's output then stops being sent there.
    fn output(&self, output: Output) -> bool;
}

/// Tells the clients of a host apart; never used again for another one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ClientId(pub NonZeroU64);

impl ClientId {
    pub fn get(self) -> u64 {
        self.0.get()
    }
}

/// Where a client's connection comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Origin {
    /// This machine, over loopback: the app and the processes that have
    /// something to tell it.
    ThisMachine,
    /// A Cogno on a paired machine, handed in by the app. It borrows
    /// sessions: it starts none, and none belongs to it.
    OtherMachine,
}

/// Who talks to the host: one connection, as its hello introduced it.
#[derive(Clone)]
pub struct Client {
    pub id: ClientId,
    pub origin: Origin,
    /// What the client calls itself: the machine its Cogno runs on.
    pub name: Option<String>,
    /// Where what this client's sessions report goes.
    pub sink: Arc<dyn EventSink>,
}

pub struct Host {
    sessions: Sessions,
    /// What the clients have for each other.
    relay: Relay,
    /// The Cogno home the host belongs to.
    home: PathBuf,
    /// The host's endpoint file: its shells learn it (`COGNO_HOST`), so a
    /// `cogno` of another build typed in one reaches this host.
    endpoint: PathBuf,
    /// Where shells write their start-up log; none unless the app that
    /// runs the host logs at debug level.
    bootstrap_log_dir: Option<PathBuf>,
}

impl Host {
    pub fn new(home: PathBuf, endpoint: PathBuf, bootstrap_log_dir: Option<PathBuf>) -> Self {
        Self {
            sessions: Sessions::default(),
            relay: Relay::default(),
            home,
            endpoint,
            bootstrap_log_dir,
        }
    }

    /// Answers one request of `client`. Some answers take a while (starting
    /// a shell, closing a ConPTY, walking the machine's processes): never
    /// call this on a thread that must not block (`Request::may_block`).
    pub fn handle(&self, client: &Client, request: Request) -> Reply {
        let done = |_| Response::Done;
        match request {
            Request::PtySpawn {
                options,
                window,
                stream,
            } => {
                let integration =
                    shell_integration::root(&self.home, &options.integration_version)?;
                let spawner = ShellSpawner::new(integration, self.bootstrap_log_dir.clone());
                let request = SpawnRequest {
                    options,
                    window,
                    stream,
                    host_endpoint: self.endpoint.clone(),
                };
                self.sessions
                    .spawn(client, &spawner, request)
                    .map(|spawned| match spawned {
                        Spawned::Started { shell_process_id } => {
                            Response::Spawned { shell_process_id }
                        }
                        Spawned::ShellAlreadyRuns => Response::ShellAlreadyRuns,
                    })
            }
            Request::PtyAttach {
                terminal_id,
                window,
                stream,
            } => self
                .sessions
                .attach(client, &terminal_id, window, stream)
                .map(|session| Response::Attached {
                    session: Box::new(session),
                }),
            Request::PtyDetach { terminal_id } => {
                self.sessions.detach(client.id, &terminal_id).map(done)
            }
            Request::PtyPlace {
                terminal_id,
                placement,
            } => self
                .sessions
                .place(client.id, &terminal_id, placement)
                .map(done),
            Request::PtyWrite { terminal_id, data } => {
                self.sessions.write(client.id, &terminal_id, data).map(done)
            }
            Request::PtyLineEditorAction {
                terminal_id,
                action,
                payload_json,
            } => self
                .sessions
                .execute_line_editor_action(
                    client.id,
                    &terminal_id,
                    &action,
                    payload_json.as_deref(),
                )
                .map(done),
            Request::PtyResize { terminal_id, size } => self
                .sessions
                .resize(client.id, &terminal_id, size)
                .map(done),
            Request::PtyKill { terminal_id } => {
                self.sessions.kill(client.id, &terminal_id).map(done)
            }
            Request::PtyAck {
                terminal_id,
                stream,
                seq,
            } => {
                self.sessions
                    .acknowledge(client.id, &terminal_id, stream, seq);
                Ok(Response::Done)
            }
            Request::PaneClosed {
                terminal_id,
                window,
            } => {
                self.sessions.pane_closed(
                    &Owner {
                        client: client.id,
                        window,
                    },
                    &terminal_id,
                );
                Ok(Response::Done)
            }
            Request::WindowClosed { window } => {
                self.sessions.depart(Departure::Window(Owner {
                    client: client.id,
                    window,
                }));
                Ok(Response::Done)
            }
            Request::ListSessions => Ok(Response::Sessions {
                sessions: self.sessions.list(client.id),
            }),
            Request::GetSession { terminal_id } => {
                self.sessions
                    .get(client.id, &terminal_id)
                    .map(|session| Response::Session {
                        session: Box::new(session),
                    })
            }
            Request::ProcessTree { terminal_id } => get_process_tree_snapshot(
                self.sessions.shell_process_id(&terminal_id)?,
            )
            .map(|snapshot| Response::ProcessTree {
                snapshot: Box::new(snapshot),
            }),
            Request::TerminalProcesses => Ok(Response::TerminalProcesses {
                processes: list_terminal_processes(&self.sessions.shell_process_ids()),
            }),
            Request::TerminateProcess {
                terminal_id,
                process_id,
            } => terminate_process_tree(self.sessions.shell_process_id(&terminal_id)?, process_id)
                .map(done),
            Request::TerminateForegroundJob { terminal_id } => {
                self.terminate_foreground_job(&terminal_id).map(done)
            }
            Request::ListShells => Ok(Response::Shells {
                shells: detect_shells(),
            }),
            Request::InstallShellIntegration { version, files } => {
                shell_integration::install(&self.home, &version, &files).map(done)
            }
            Request::AgentHook { hook } => {
                match hook.terminal_id.clone() {
                    Some(terminal_id) => self.sessions.take_hook(&terminal_id, hook),
                    // No terminal names whose it is: every Cogno that shows
                    // one looks.
                    None => {
                        let showing = self.sessions.showing_clients();
                        self.relay.broadcast(
                            |to| to != client.id && showing.contains(&to),
                            |sink| sink.agent_hook(&hook),
                        );
                    }
                }
                Ok(Response::Done)
            }
            Request::Ask { .. } => Err(HostError::new(
                HostErrorCode::InvalidRequest,
                "A question is a request with an id: its answer comes under it",
            )),
            Request::Answer { relay, answer } => {
                self.relay.answer(client.id, relay, answer);
                Ok(Response::Done)
            }
            Request::OwnPrompts { session } => {
                self.relay.own_prompts(client.id, session);
                Ok(Response::Done)
            }
            Request::DisownPrompts { session } => {
                self.relay.disown_prompts(client.id, &session);
                Ok(Response::Done)
            }
            Request::Unknown => Err(HostError::new(
                HostErrorCode::UnknownRequest,
                "A request this host does not know",
            )),
        }
    }

    #[cfg(unix)]
    fn terminate_foreground_job(&self, terminal_id: &str) -> Result<(), HostError> {
        let shell = self.sessions.shell_process_id(terminal_id)?;
        let group = self.sessions.foreground_process_group(terminal_id)?;
        crate::processes::terminate_foreground_job(shell, group, terminal_id)
    }

    /// Windows has no foreground job: everything under the shell ends.
    #[cfg(windows)]
    fn terminate_foreground_job(&self, terminal_id: &str) -> Result<(), HostError> {
        let shell = self.sessions.shell_process_id(terminal_id)?;
        crate::processes::terminate_processes_under(shell, terminal_id)
    }

    /// Passes `client`'s question, which waits under request `id`, on to
    /// the client `to` names; the answer comes later, under that id. Nobody
    /// there: `NoAddressee` at once. What is asked the host never reads.
    /// Never blocks.
    pub fn ask(&self, client: &Client, id: u64, to: Addressee, question: String) {
        let answerer = match &to {
            Addressee::Terminal { terminal_id } => self.sessions.shown_by(terminal_id),
            Addressee::PromptSession { session } => self.relay.prompt_owner(session),
            Addressee::Unknown => {
                client.sink.reply(
                    id,
                    Err(HostError::new(
                        HostErrorCode::InvalidRequest,
                        "An addressee this host does not know",
                    )),
                );
                return;
            }
        };
        let asked = match answerer {
            Some(answerer) => self
                .relay
                .ask(client.id, id, answerer, |relay| Event::Asked {
                    relay,
                    to,
                    question,
                }),
            None => Err(no_addressee()),
        };
        if let Err(error) = asked {
            client.sink.reply(id, Err(error));
        }
    }

    /// `client` is connected: what others have for it can reach it.
    pub fn client_came(&self, client: &Client) {
        self.relay.came(client);
    }

    /// The client is gone, for whatever reason. Its sessions end with it;
    /// the ones it borrowed go back to their windows.
    pub fn client_gone(&self, client: ClientId) {
        self.relay.gone(client);
        self.sessions.depart(Departure::Client(client));
    }

    /// Ends every shell: what the app does on its way out.
    pub fn shut_down_all(&self) {
        self.sessions.shut_down_all();
    }

    /// The window the terminal belongs to.
    #[cfg(test)]
    pub fn window_of(&self, terminal_id: &str) -> Option<String> {
        self.sessions
            .owner_of(terminal_id)
            .map(|owner| owner.window)
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use crate::protocol::{Request, ShellProfile, ShellType, SpawnOptions, StreamId, TerminalSize};

    /// The shell prints `ready` and waits for input itself: a child process
    /// of its own could outlive a kill and keep the console, and with it the
    /// stream, open.
    #[cfg(windows)]
    pub(crate) const WAITING: &str = "echo ready & pause";
    #[cfg(unix)]
    pub(crate) const WAITING: &str = "echo ready; read line";

    /// The shell prints `first`, a moment later `second`, and then waits.
    #[cfg(windows)]
    pub(crate) const TWO_LINES: &str =
        "echo first & ping -n 2 127.0.0.1 >nul & echo second & pause";
    #[cfg(unix)]
    pub(crate) const TWO_LINES: &str = "echo first; sleep 1; echo second; read line";

    pub(crate) const WINDOW: &str = "window-1";

    /// A spawn of the platform's plain shell running `script`, without
    /// integration.
    pub(crate) fn spawn_request(terminal_id: &str, stream: u64, script: &str) -> Request {
        #[cfg(windows)]
        let (shell_type, path, flag) = (ShellType::PowerShell, "cmd.exe", "/C");
        #[cfg(unix)]
        let (shell_type, path, flag) = (ShellType::Bash, "/bin/sh", "-c");
        Request::PtySpawn {
            options: SpawnOptions {
                terminal_id: terminal_id.to_string(),
                size: TerminalSize { cols: 80, rows: 24 },
                profile: ShellProfile {
                    shell_type,
                    path: Some(path.to_string()),
                    args: Some(vec![flag.to_string(), script.to_string()]),
                    env: None,
                    working_dir: Some(std::env::temp_dir().to_string_lossy().to_string()),
                    enable_shell_integration: Some(false),
                    inject_cogno_cli: Some(false),
                    load_user_rc: None,
                },
                integration_version: "test".to_string(),
            },
            window: WINDOW.to_string(),
            stream: StreamId(stream),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{spawn_request, TWO_LINES, WAITING, WINDOW};
    use super::*;
    use crate::protocol::{
        Attached, ExitReason, RelayId, SessionPlacement, StreamId, TerminalSize,
    };
    use crate::sessions::test_support::client_id;
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    #[derive(Default)]
    struct Recorded {
        output: Vec<(StreamId, Vec<u8>)>,
        ended_streams: Vec<StreamId>,
        /// Terminal id and window of every reported exit.
        exits: Vec<(String, String)>,
        exit_reasons: Vec<ExitReason>,
        /// Terminal id, window and taker's name of every session taken over.
        taken_over: Vec<(String, String, Option<String>)>,
        /// Terminal id and window of every session that came free again.
        handed_back: Vec<(String, String)>,
        /// Event and `replayed` of every agent hook passed on.
        hooks: Vec<(String, bool)>,
        /// Every question passed on to this client, with whom it named.
        asked: Vec<(RelayId, Addressee, String)>,
        /// Every reply that came later than its request: what was answered,
        /// or the error's code.
        replies: Vec<(u64, Result<String, HostErrorCode>)>,
    }

    #[derive(Default)]
    struct RecordingSink(Mutex<Recorded>);

    impl EventSink for RecordingSink {
        fn event(&self, event: Event) {
            let mut recorded = self.0.lock().unwrap();
            match event {
                Event::PtyStreamEnded { stream } => recorded.ended_streams.push(stream),
                Event::PtyExit {
                    terminal_id,
                    window,
                    reason,
                } => {
                    recorded.exits.push((terminal_id, window));
                    recorded.exit_reasons.push(reason);
                }
                Event::PtyTakenOver {
                    terminal_id,
                    window,
                    by,
                } => recorded.taken_over.push((terminal_id, window, by)),
                Event::PtyHandedBack {
                    terminal_id,
                    window,
                } => recorded.handed_back.push((terminal_id, window)),
                Event::AgentHook { hook, replayed } => recorded.hooks.push((hook.event, replayed)),
                Event::Asked {
                    relay,
                    to,
                    question,
                } => recorded.asked.push((relay, to, question)),
                Event::Unknown => {}
            }
        }

        fn reply(&self, id: u64, reply: Reply) {
            let reply = match reply {
                Ok(Response::Answered { answer }) => Ok(answer),
                Ok(other) => panic!("a later reply that answers nothing: {other:?}"),
                Err(error) => Err(error.code),
            };
            self.0.lock().unwrap().replies.push((id, reply));
        }

        fn output(&self, output: Output) -> bool {
            self.0
                .lock()
                .unwrap()
                .output
                .push((output.stream, output.bytes));
            true
        }
    }

    impl RecordingSink {
        fn output_of(&self, stream: u64) -> String {
            let recorded = self.0.lock().unwrap();
            let bytes: Vec<u8> = recorded
                .output
                .iter()
                .filter(|(of, _)| *of == StreamId(stream))
                .flat_map(|(_, bytes)| bytes.clone())
                .collect();
            String::from_utf8_lossy(&bytes).to_string()
        }

        fn ended_streams(&self) -> Vec<u64> {
            let recorded = self.0.lock().unwrap();
            recorded
                .ended_streams
                .iter()
                .map(|stream| stream.0)
                .collect()
        }
    }

    /// A client of this machine, and what the host sent it.
    fn client(id: u64) -> (Client, Arc<RecordingSink>) {
        client_of(id, Origin::ThisMachine, None)
    }

    /// A Cogno on another machine that calls itself `name`.
    fn other_machine(id: u64, name: Option<&str>) -> (Client, Arc<RecordingSink>) {
        client_of(id, Origin::OtherMachine, name)
    }

    fn client_of(id: u64, origin: Origin, name: Option<&str>) -> (Client, Arc<RecordingSink>) {
        let sink = Arc::new(RecordingSink::default());
        (
            Client {
                id: client_id(id),
                origin,
                name: name.map(str::to_string),
                sink: sink.clone(),
            },
            sink,
        )
    }

    fn host() -> Host {
        let home = std::env::temp_dir().join("cogno-host-test-home");
        Host::new(home.clone(), home.join("host.json"), None)
    }

    /// The shell lives in another process: waits up to ten seconds.
    fn wait_until(what: &str, mut condition: impl FnMut() -> bool) {
        let started = Instant::now();
        while !condition() {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "timed out waiting until {what}"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    fn attach_request(terminal_id: &str, stream: u64) -> Request {
        attach_request_of(terminal_id, WINDOW, stream)
    }

    fn attach_request_of(terminal_id: &str, window: &str, stream: u64) -> Request {
        Request::PtyAttach {
            terminal_id: terminal_id.to_string(),
            window: window.to_string(),
            stream: StreamId(stream),
        }
    }

    fn detach_request(terminal_id: &str) -> Request {
        Request::PtyDetach {
            terminal_id: terminal_id.to_string(),
        }
    }

    fn kill_request(terminal_id: &str) -> Request {
        Request::PtyKill {
            terminal_id: terminal_id.to_string(),
        }
    }

    fn window_closed(window: &str) -> Request {
        Request::WindowClosed {
            window: window.to_string(),
        }
    }

    /// Each session's terminal id and whether a client shows it.
    fn sessions_of(host: &Host, client: &Client) -> Vec<(String, bool)> {
        match host.handle(client, Request::ListSessions) {
            Ok(Response::Sessions { sessions }) => sessions
                .into_iter()
                .map(|session| (session.terminal_id, session.attached != Attached::Nowhere))
                .collect(),
            other => panic!("no session list: {other:?}"),
        }
    }

    fn handed_back(sink: &RecordingSink) -> Vec<(String, String)> {
        sink.0.lock().unwrap().handed_back.clone()
    }

    fn exits(sink: &RecordingSink) -> Vec<(String, String)> {
        sink.0.lock().unwrap().exits.clone()
    }

    fn t1_of_window_1() -> Vec<(String, String)> {
        vec![("t1".to_string(), WINDOW.to_string())]
    }

    #[test]
    fn a_session_sends_its_output_under_its_stream_and_a_kill_ends_it_without_an_exit() {
        let (me, sink) = client(1);
        let host = host();

        let spawned = host.handle(&me, spawn_request("t1", 7, WAITING));
        assert!(matches!(spawned, Ok(Response::Spawned { .. })));
        assert_eq!(host.window_of("t1").as_deref(), Some(WINDOW));
        wait_until("the shell printed", || sink.output_of(7).contains("ready"));

        assert!(host.handle(&me, kill_request("t1")).is_ok());
        wait_until("the stream ended", || sink.ended_streams() == [7]);
        assert_eq!(host.window_of("t1"), None);
        assert!(exits(&sink).is_empty());
    }

    #[test]
    fn a_shell_that_ends_on_its_own_reports_its_exit_and_code_to_its_window() {
        let (me, sink) = client(1);
        let host = host();

        let spawned = host.handle(&me, spawn_request("t2", 1, "exit 3"));
        assert!(matches!(spawned, Ok(Response::Spawned { .. })));
        wait_until("the exit was reported", || !exits(&sink).is_empty());

        assert_eq!(exits(&sink), [("t2".to_string(), WINDOW.to_string())]);
        assert_eq!(
            sink.0.lock().unwrap().exit_reasons,
            [ExitReason::Exited { code: 3 }]
        );
        host.shut_down_all();
    }

    #[test]
    fn a_cogno_that_attaches_later_gets_what_it_missed() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = other_machine(2, None);
        let host = host();
        host.handle(&office, spawn_request("t1", 1, TWO_LINES))
            .unwrap();
        wait_until("the first line was printed", || {
            at_the_office.output_of(1).contains("first")
        });

        // The laptop takes it before the shell prints its second line.
        host.handle(&laptop, attach_request("t1", 9)).unwrap();

        wait_until("the laptop has both lines", || {
            let output = on_the_laptop.output_of(9);
            output.contains("first") && output.contains("second")
        });
        assert_eq!(sessions_of(&host, &laptop), [("t1".to_string(), true)]);
        assert!(!at_the_office.output_of(1).contains("second"));
        host.shut_down_all();
    }

    #[test]
    fn a_session_ends_with_its_client() {
        let (me, _sink) = client(1);
        let (other, _) = client(2);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();
        host.handle(&other, spawn_request("t2", 1, WAITING))
            .unwrap();

        host.client_gone(me.id);

        // Only the client that is gone loses its session.
        assert_eq!(sessions_of(&host, &other), [("t2".to_string(), true)]);
        host.shut_down_all();
    }

    #[test]
    fn a_client_that_is_gone_attaches_nothing_and_starts_nothing() {
        let (gone, _) = client(1);
        let (other, _) = client(2);
        let host = host();
        host.handle(&other, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.client_gone(gone.id);

        // Requests of the gone client that were still on their way.
        let attached = host.handle(&gone, attach_request("t1", 3));
        let spawned = host.handle(&gone, spawn_request("t2", 4, WAITING));

        assert_eq!(attached.unwrap_err().code, HostErrorCode::WindowClosed);
        assert_eq!(spawned.unwrap_err().code, HostErrorCode::WindowClosed);
        assert_eq!(sessions_of(&host, &other), [("t1".to_string(), true)]);
        host.shut_down_all();
    }

    #[test]
    fn a_second_client_takes_a_session_over_and_the_first_is_told() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = client(2);
        let host = host();
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        wait_until("the shell printed the port", || {
            at_the_office.output_of(1).contains("ready")
        });

        let attached = host.handle(&laptop, attach_request("t1", 5));

        assert!(matches!(
            attached,
            Ok(Response::Attached { session }) if session.attached == Attached::ThisClient
        ));
        wait_until("the laptop has the output so far", || {
            on_the_laptop.output_of(5).contains("ready")
        });
        assert_eq!(at_the_office.ended_streams(), [1]);
        assert_eq!(
            at_the_office.0.lock().unwrap().taken_over,
            [("t1".to_string(), WINDOW.to_string(), None)]
        );
        // It is the laptop's now: the office going away changes nothing.
        host.client_gone(office.id);
        assert_eq!(sessions_of(&host, &laptop), [("t1".to_string(), true)]);
        host.shut_down_all();
    }

    #[test]
    fn a_client_can_let_go_of_a_session_and_come_back_to_it() {
        let (me, sink) = client(1);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();
        wait_until("the shell printed the port", || {
            sink.output_of(1).contains("ready")
        });

        assert!(host.handle(&me, detach_request("t1")).is_ok());
        assert_eq!(sink.ended_streams(), [1]);
        assert_eq!(sessions_of(&host, &me), [("t1".to_string(), false)]);

        host.handle(&me, attach_request("t1", 2)).unwrap();
        wait_until("the output came again", || {
            sink.output_of(2).contains("ready")
        });
        // Nobody was taken over: the session had no client.
        assert!(sink.0.lock().unwrap().taken_over.is_empty());
        host.shut_down_all();
    }

    #[test]
    fn a_session_says_where_it_sits_and_who_shows_it() {
        let (office, _) = client_of(1, Origin::ThisMachine, Some("office-pc"));
        let (laptop, on_the_laptop) = other_machine(2, Some("lars-laptop"));
        let host = host();
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        let placement = SessionPlacement {
            workspace: Some("Backend".to_string()),
            tab: Some("api".to_string()),
            title: Some("npm run dev".to_string()),
            directory: Some("C:\\dev\\api".to_string()),
        };
        host.handle(
            &office,
            Request::PtyPlace {
                terminal_id: "t1".to_string(),
                placement: placement.clone(),
            },
        )
        .unwrap();
        let listed = |asker: &Client| match host.handle(asker, Request::ListSessions) {
            Ok(Response::Sessions { mut sessions }) => sessions.remove(0),
            other => panic!("no session list: {other:?}"),
        };

        // The laptop finds it by its place, shown at the office.
        let seen = listed(&laptop);
        assert_eq!(seen.placement, placement);
        assert_eq!(
            seen.attached,
            Attached::OtherClient {
                by: Some("office-pc".to_string())
            }
        );

        // It takes it over: the office is told by whom.
        host.handle(&laptop, attach_request("t1", 9)).unwrap();
        wait_until("the laptop has the output", || {
            on_the_laptop.output_of(9).contains("ready")
        });
        assert_eq!(
            listed(&office).attached,
            Attached::OtherClient {
                by: Some("lars-laptop".to_string())
            }
        );
        assert_eq!(listed(&laptop).attached, Attached::ThisClient);

        // The office's placement crossed the takeover: it changes nothing.
        let crossed = host.handle(
            &office,
            Request::PtyPlace {
                terminal_id: "t1".to_string(),
                placement: SessionPlacement::default(),
            },
        );
        assert_eq!(crossed.unwrap_err().code, HostErrorCode::AttachedElsewhere);
        assert_eq!(listed(&laptop).placement, placement);
        host.shut_down_all();
    }

    #[test]
    fn a_session_that_was_taken_over_does_not_end_with_the_client_that_took_it() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = other_machine(2, Some("lars-laptop"));
        let host = host();
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.handle(&laptop, attach_request("t1", 5)).unwrap();
        wait_until("the laptop has the output", || {
            on_the_laptop.output_of(5).contains("ready")
        });
        assert_eq!(
            at_the_office.0.lock().unwrap().taken_over,
            [(
                "t1".to_string(),
                WINDOW.to_string(),
                Some("lars-laptop".to_string())
            )]
        );

        // The laptop is closed without a word.
        host.client_gone(laptop.id);

        // The shell is still there for the office to take back.
        assert_eq!(sessions_of(&host, &office), [("t1".to_string(), false)]);
        host.handle(&office, attach_request("t1", 2)).unwrap();
        wait_until("the office has it back", || {
            at_the_office.output_of(2).contains("ready")
        });
        host.shut_down_all();
    }

    #[test]
    fn attaching_to_a_session_that_is_not_there_fails_with_its_code() {
        let (me, _sink) = client(1);
        let host = host();

        let attached = host.handle(&me, attach_request("nobody", 1));
        assert_eq!(attached.unwrap_err().code, HostErrorCode::SessionNotFound);
    }

    #[test]
    fn a_session_is_found_by_its_id_before_anyone_attaches() {
        let (office, _) = client(1);
        let (laptop, _) = client(2);
        let host = host();
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();

        let found = host.handle(
            &laptop,
            Request::GetSession {
                terminal_id: "t1".to_string(),
            },
        );
        let missing = host.handle(
            &laptop,
            Request::GetSession {
                terminal_id: "t2".to_string(),
            },
        );

        assert!(matches!(
            found,
            Ok(Response::Session { session }) if session.terminal_id == "t1"
        ));
        assert_eq!(missing.unwrap_err().code, HostErrorCode::SessionNotFound);
        host.shut_down_all();
    }

    #[test]
    fn a_request_this_host_does_not_know_is_refused_with_its_code() {
        let (me, _sink) = client(1);
        let refused = host().handle(&me, Request::Unknown);
        assert_eq!(refused.unwrap_err().code, HostErrorCode::UnknownRequest);
    }

    #[test]
    fn a_client_that_attaches_again_has_not_been_taken_over() {
        let (me, sink) = client(1);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();

        host.handle(&me, attach_request("t1", 2)).unwrap();

        wait_until("the output came again", || {
            sink.output_of(2).contains("ready")
        });
        assert_eq!(sink.ended_streams(), [1]);
        assert!(sink.0.lock().unwrap().taken_over.is_empty());
        host.shut_down_all();
    }

    /// The office started `t1`; the laptop has taken it over.
    struct TakenOver {
        host: Host,
        office: Client,
        at_the_office: Arc<RecordingSink>,
        laptop: Client,
        on_the_laptop: Arc<RecordingSink>,
    }

    /// The office's shell, borrowed by the laptop.
    fn taken_over_by_the_laptop() -> TakenOver {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = other_machine(2, None);
        let host = host();
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.handle(&laptop, attach_request("t1", 5)).unwrap();
        wait_until("the laptop has the output", || {
            on_the_laptop.output_of(5).contains("ready")
        });
        TakenOver {
            host,
            office,
            at_the_office,
            laptop,
            on_the_laptop,
        }
    }

    #[test]
    fn whoever_lost_a_session_hears_when_it_is_let_go() {
        let taken = taken_over_by_the_laptop();
        assert!(handed_back(&taken.at_the_office).is_empty());

        taken
            .host
            .handle(&taken.laptop, detach_request("t1"))
            .unwrap();

        assert_eq!(handed_back(&taken.at_the_office), t1_of_window_1());
        // The one that let it go knows that already.
        assert!(handed_back(&taken.on_the_laptop).is_empty());
        taken.host.shut_down_all();
    }

    #[test]
    fn whoever_lost_a_session_hears_when_its_taker_is_gone() {
        let taken = taken_over_by_the_laptop();

        // The laptop is closed without a word.
        taken.host.client_gone(taken.laptop.id);

        assert_eq!(handed_back(&taken.at_the_office), t1_of_window_1());
        taken.host.shut_down_all();
    }

    #[test]
    fn whoever_lost_a_session_hears_when_the_takers_window_closes() {
        let taken = taken_over_by_the_laptop();

        taken
            .host
            .handle(&taken.laptop, window_closed(WINDOW))
            .unwrap();

        assert_eq!(handed_back(&taken.at_the_office), t1_of_window_1());
        taken.host.shut_down_all();
    }

    #[test]
    fn an_owner_that_took_its_session_back_waits_for_nobody() {
        let taken = taken_over_by_the_laptop();

        // The office takes it back, then lets it go itself - twice over.
        taken
            .host
            .handle(&taken.office, attach_request("t1", 2))
            .unwrap();
        for _ in 0..2 {
            taken
                .host
                .handle(&taken.office, detach_request("t1"))
                .unwrap();
        }

        // The laptop only borrowed it: it does not go back there.
        assert!(handed_back(&taken.on_the_laptop).is_empty());
        assert!(handed_back(&taken.at_the_office).is_empty());
        taken.host.shut_down_all();
    }

    #[test]
    fn a_session_goes_back_to_its_owner_whoever_borrowed_it_last() {
        let taken = taken_over_by_the_laptop();
        let (tablet, on_the_tablet) = other_machine(3, None);

        // A third machine takes it from the laptop, then lets it go.
        taken.host.handle(&tablet, attach_request("t1", 6)).unwrap();
        taken.host.handle(&tablet, detach_request("t1")).unwrap();

        assert_eq!(handed_back(&taken.at_the_office), t1_of_window_1());
        assert!(handed_back(&taken.on_the_laptop).is_empty());
        assert!(handed_back(&on_the_tablet).is_empty());
        taken.host.shut_down_all();
    }

    #[test]
    fn a_session_ends_with_its_owner_also_while_another_machine_shows_it() {
        let taken = taken_over_by_the_laptop();

        // The office closes while the laptop shows its shell.
        taken.host.client_gone(taken.office.id);

        wait_until("the laptop heard of the end", || {
            exits(&taken.on_the_laptop) == t1_of_window_1()
        });
        assert_eq!(
            taken.on_the_laptop.0.lock().unwrap().exit_reasons,
            [ExitReason::KilledByAnotherClient]
        );
        assert!(sessions_of(&taken.host, &taken.laptop).is_empty());
        taken.host.shut_down_all();
    }

    fn pane_closed(terminal_id: &str, window: &str) -> Request {
        Request::PaneClosed {
            terminal_id: terminal_id.to_string(),
            window: window.to_string(),
        }
    }

    #[test]
    fn closing_its_pane_ends_a_session_also_while_another_machine_shows_it() {
        let taken = taken_over_by_the_laptop();

        taken
            .host
            .handle(&taken.office, pane_closed("t1", WINDOW))
            .unwrap();

        assert_eq!(exits(&taken.on_the_laptop), t1_of_window_1());
        // The window that closed the pane knows that already.
        assert!(exits(&taken.at_the_office).is_empty());
        assert!(sessions_of(&taken.host, &taken.laptop).is_empty());
        taken.host.shut_down_all();
    }

    #[test]
    fn only_the_window_a_session_belongs_to_ends_it_by_closing_a_pane() {
        let taken = taken_over_by_the_laptop();

        // Another window of the office, and the laptop that borrowed it.
        taken
            .host
            .handle(&taken.office, pane_closed("t1", "window-2"))
            .unwrap();
        taken
            .host
            .handle(&taken.laptop, pane_closed("t1", WINDOW))
            .unwrap();

        assert_eq!(
            sessions_of(&taken.host, &taken.office),
            [("t1".to_string(), true)]
        );
        taken.host.shut_down_all();
    }

    #[test]
    fn a_cogno_on_another_machine_starts_no_shell() {
        let (laptop, _) = other_machine(2, None);
        let host = host();

        let refused = host.handle(&laptop, spawn_request("t1", 1, WAITING));

        assert_eq!(refused.unwrap_err().code, HostErrorCode::InvalidRequest);
        assert!(sessions_of(&host, &laptop).is_empty());
    }

    #[test]
    fn whoever_shows_or_waits_for_a_session_hears_when_another_ends_it() {
        let taken = taken_over_by_the_laptop();
        let (panel, _) = client(3);

        // A third Cogno ends it from its Remote panel.
        taken.host.handle(&panel, kill_request("t1")).unwrap();

        assert_eq!(exits(&taken.on_the_laptop), t1_of_window_1());
        assert_eq!(
            taken.on_the_laptop.0.lock().unwrap().exit_reasons,
            [ExitReason::KilledByAnotherClient]
        );
        // The office waited for it to come back; it will not.
        assert_eq!(exits(&taken.at_the_office), t1_of_window_1());
        taken.host.shut_down_all();
    }

    #[test]
    fn a_client_that_ends_its_own_session_hears_nothing_back() {
        let taken = taken_over_by_the_laptop();

        taken
            .host
            .handle(&taken.laptop, kill_request("t1"))
            .unwrap();

        assert!(exits(&taken.on_the_laptop).is_empty());
        assert_eq!(exits(&taken.at_the_office), t1_of_window_1());
        taken.host.shut_down_all();
    }

    #[test]
    fn a_client_that_no_longer_shows_a_session_cannot_let_it_go() {
        let taken = taken_over_by_the_laptop();

        // The office's request crossed the takeover.
        taken
            .host
            .handle(&taken.office, detach_request("t1"))
            .unwrap();

        assert_eq!(
            sessions_of(&taken.host, &taken.office),
            [("t1".to_string(), true)]
        );
        assert!(handed_back(&taken.at_the_office).is_empty());
        taken.host.shut_down_all();
    }

    #[test]
    fn a_session_taken_by_another_window_of_this_app_ends_with_that_window() {
        let (me, sink) = client(1);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();
        host.handle(&me, attach_request_of("t1", "window-2", 2))
            .unwrap();

        host.handle(&me, window_closed("window-2")).unwrap();

        // The window it was taken from waited for it; it will not come back.
        wait_until("the first window heard of the end", || {
            exits(&sink) == t1_of_window_1()
        });
        assert!(sessions_of(&host, &me).is_empty());
        host.shut_down_all();
    }

    #[test]
    fn only_the_client_that_shows_a_session_types_into_it_or_sizes_it() {
        let taken = taken_over_by_the_laptop();

        // The office's typing crossed the takeover.
        let typed = taken.host.handle(
            &taken.office,
            Request::PtyWrite {
                terminal_id: "t1".to_string(),
                data: "echo typed by the office".to_string(),
            },
        );
        let sized = taken.host.handle(
            &taken.office,
            Request::PtyResize {
                terminal_id: "t1".to_string(),
                size: TerminalSize { cols: 20, rows: 5 },
            },
        );

        assert_eq!(typed.unwrap_err().code, HostErrorCode::AttachedElsewhere);
        assert_eq!(sized.unwrap_err().code, HostErrorCode::AttachedElsewhere);
        let by_the_laptop = taken.host.handle(
            &taken.laptop,
            Request::PtyWrite {
                terminal_id: "t1".to_string(),
                data: "echo typed by the laptop".to_string(),
            },
        );
        assert!(by_the_laptop.is_ok());
        taken.host.shut_down_all();
    }

    #[test]
    fn a_shell_that_runs_is_never_ended_to_start_another_under_its_id() {
        let (me, sink) = client(1);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();
        wait_until("the shell runs", || sink.output_of(1).contains("ready"));

        let refused = host.handle(&me, spawn_request("t1", 2, WAITING));

        assert!(matches!(refused, Ok(Response::ShellAlreadyRuns)));
        assert_eq!(sessions_of(&host, &me), [("t1".to_string(), true)]);
        // The first one still writes to its client.
        assert!(sink.ended_streams().is_empty());
        host.shut_down_all();
    }

    #[test]
    fn nobody_hears_of_a_session_that_was_taken_from_nobody() {
        let (me, sink) = client(1);
        let (laptop, on_the_laptop) = other_machine(2, None);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();
        // Its window lets it go; the session runs on with nobody showing it.
        host.handle(&me, detach_request("t1")).unwrap();

        host.handle(&laptop, attach_request("t1", 5)).unwrap();
        host.handle(&laptop, detach_request("t1")).unwrap();

        assert!(handed_back(&sink).is_empty());
        assert!(handed_back(&on_the_laptop).is_empty());
        host.shut_down_all();
    }

    #[test]
    fn another_window_of_the_same_client_takes_a_session_over_too() {
        let (me, sink) = client_of(1, Origin::ThisMachine, Some("office-pc"));
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();

        host.handle(&me, attach_request_of("t1", "window-2", 2))
            .unwrap();

        wait_until("the other window has the output", || {
            sink.output_of(2).contains("ready")
        });
        // The window that showed it must hear that it no longer does.
        assert_eq!(
            sink.0.lock().unwrap().taken_over,
            [(
                "t1".to_string(),
                WINDOW.to_string(),
                Some("office-pc".to_string())
            )]
        );
        host.shut_down_all();
    }

    #[test]
    fn closing_a_window_ends_its_sessions() {
        let (me, sink) = client(1);
        let host = host();
        host.handle(&me, spawn_request("t1", 1, WAITING)).unwrap();
        host.handle(&me, spawn_request("t2", 2, WAITING)).unwrap();
        let mut in_another_window = spawn_request("other", 3, WAITING);
        if let Request::PtySpawn { window, .. } = &mut in_another_window {
            *window = "window-2".to_string();
        }
        host.handle(&me, in_another_window).unwrap();

        host.handle(&me, window_closed(WINDOW)).unwrap();

        // The other window's session is left alone.
        assert_eq!(sessions_of(&host, &me), [("other".to_string(), true)]);
        wait_until("both streams ended", || {
            let mut ended = sink.ended_streams();
            ended.sort();
            ended == [1, 2]
        });
        host.shut_down_all();
    }

    #[test]
    fn two_clients_can_name_their_windows_alike() {
        let (first, _) = client(1);
        let (second, _) = client(2);
        let host = host();

        // The first client's window "window-1" is closed for good ...
        host.handle(&first, window_closed(WINDOW)).unwrap();
        // ... which is not the second client's window of that name.
        let spawned = host.handle(&second, spawn_request("t1", 1, WAITING));
        assert!(matches!(spawned, Ok(Response::Spawned { .. })));
        // The first client's own late spawn is still refused.
        let late = host.handle(&first, spawn_request("t2", 1, WAITING));
        assert_eq!(late.unwrap_err().code, HostErrorCode::WindowClosed);
        host.shut_down_all();
    }

    fn hook(terminal_id: Option<&str>, event: &str) -> Request {
        Request::AgentHook {
            hook: AgentHook::of(terminal_id, event),
        }
    }

    fn hooks_of(sink: &RecordingSink) -> Vec<(String, bool)> {
        sink.0.lock().unwrap().hooks.clone()
    }

    fn terminal(terminal_id: &str) -> Addressee {
        Addressee::Terminal {
            terminal_id: terminal_id.to_string(),
        }
    }

    fn prompt_session(session: &str) -> Addressee {
        Addressee::PromptSession {
            session: session.to_string(),
        }
    }

    /// What the host passes on unread.
    const QUESTION: &str = r#"{"anything":"at all"}"#;

    fn asked_of(sink: &RecordingSink) -> Vec<(RelayId, Addressee, String)> {
        sink.0.lock().unwrap().asked.clone()
    }

    fn replies_of(sink: &RecordingSink) -> Vec<(u64, Result<String, HostErrorCode>)> {
        sink.0.lock().unwrap().replies.clone()
    }

    #[test]
    fn a_hook_goes_to_whoever_shows_its_terminal_and_is_kept_for_whoever_comes_next() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = client(2);
        let (agent, _) = client(3);
        let host = host();
        for client in [&office, &laptop, &agent] {
            host.client_came(client);
        }
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();

        host.handle(&agent, hook(Some("t1"), "UserPromptSubmit"))
            .unwrap();
        host.handle(&agent, hook(Some("nowhere"), "Stop")).unwrap();

        assert_eq!(
            hooks_of(&at_the_office),
            [("UserPromptSubmit".to_string(), false)]
        );
        assert!(hooks_of(&on_the_laptop).is_empty());

        // There is output to play back first.
        wait_until("the shell printed", || {
            at_the_office.output_of(1).contains("ready")
        });
        host.handle(&laptop, attach_request("t1", 5)).unwrap();
        // Held until the laptop has taken in the replayed output: parsing it,
        // it goes through every command that ended back then.
        assert!(hooks_of(&on_the_laptop).is_empty());
        // An ack of the stream the laptop had before is late: it releases
        // nothing.
        host.handle(
            &laptop,
            Request::PtyAck {
                terminal_id: "t1".to_string(),
                stream: StreamId(4),
                seq: 0,
            },
        )
        .unwrap();
        assert!(hooks_of(&on_the_laptop).is_empty());
        host.handle(
            &laptop,
            Request::PtyAck {
                terminal_id: "t1".to_string(),
                stream: StreamId(5),
                seq: 0,
            },
        )
        .unwrap();
        // Not news: it was kept, and comes because the laptop attached.
        assert_eq!(
            hooks_of(&on_the_laptop),
            [("UserPromptSubmit".to_string(), true)]
        );
        host.handle(&agent, hook(Some("t1"), "Stop")).unwrap();
        assert_eq!(
            hooks_of(&on_the_laptop),
            [
                ("UserPromptSubmit".to_string(), true),
                ("Stop".to_string(), false)
            ]
        );
        assert_eq!(hooks_of(&at_the_office).len(), 1);
        host.shut_down_all();
    }

    #[test]
    fn hooks_held_for_a_replay_come_before_a_newer_one() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = client(2);
        let (agent, _) = client(3);
        let host = host();
        for client in [&office, &laptop, &agent] {
            host.client_came(client);
        }
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.handle(&agent, hook(Some("t1"), "UserPromptSubmit"))
            .unwrap();
        wait_until("the shell printed", || {
            at_the_office.output_of(1).contains("ready")
        });
        host.handle(&laptop, attach_request("t1", 5)).unwrap();

        // No acknowledgement yet, and the agent says something new.
        host.handle(&agent, hook(Some("t1"), "Stop")).unwrap();

        assert_eq!(
            hooks_of(&on_the_laptop),
            [
                ("UserPromptSubmit".to_string(), true),
                ("Stop".to_string(), false)
            ]
        );
        host.shut_down_all();
    }

    #[test]
    fn a_hook_that_names_no_terminal_goes_to_every_other_client_that_shows_one() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = client(2);
        let (agent, from_the_agent) = client(3);
        let (cli, from_the_cli) = client(4);
        let host = host();
        for client in [&office, &laptop, &agent, &cli] {
            host.client_came(client);
        }
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.handle(&laptop, spawn_request("t2", 1, WAITING))
            .unwrap();
        host.handle(&agent, spawn_request("t3", 1, WAITING))
            .unwrap();

        host.handle(&agent, hook(None, "session.idle")).unwrap();

        assert_eq!(
            hooks_of(&at_the_office),
            [("session.idle".to_string(), false)]
        );
        assert_eq!(
            hooks_of(&on_the_laptop),
            [("session.idle".to_string(), false)]
        );
        assert!(hooks_of(&from_the_agent).is_empty());
        // A process that only asked or told something shows nothing.
        assert!(hooks_of(&from_the_cli).is_empty());
        host.shut_down_all();
    }

    #[test]
    fn a_question_about_a_terminal_goes_to_whoever_shows_it_and_the_answer_comes_back() {
        let (office, at_the_office) = client(1);
        let (cli, from_the_cli) = client(2);
        let host = host();
        host.client_came(&office);
        host.client_came(&cli);
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();

        host.ask(&cli, 42, terminal("t1"), QUESTION.to_string());
        let asked = asked_of(&at_the_office);
        assert_eq!(asked.len(), 1);
        assert_eq!(asked[0].1, terminal("t1"));
        assert_eq!(asked[0].2, QUESTION);
        assert!(replies_of(&from_the_cli).is_empty());

        let answer = r#"{"status":"dispatched"}"#.to_string();
        // Only the client the question went to answers it.
        host.handle(
            &cli,
            Request::Answer {
                relay: asked[0].0,
                answer: answer.clone(),
            },
        )
        .unwrap();
        assert!(replies_of(&from_the_cli).is_empty());
        host.handle(
            &office,
            Request::Answer {
                relay: asked[0].0,
                answer: answer.clone(),
            },
        )
        .unwrap();

        assert_eq!(replies_of(&from_the_cli), [(42, Ok(answer))]);
        host.shut_down_all();
    }

    #[test]
    fn a_question_nobody_is_there_to_answer_fails_at_once() {
        let (office, _) = client(1);
        let (cli, from_the_cli) = client(2);
        let host = host();
        host.client_came(&office);
        host.client_came(&cli);
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.handle(&office, detach_request("t1")).unwrap();

        host.ask(&cli, 1, terminal("t1"), QUESTION.to_string());
        host.ask(&cli, 2, terminal("unknown"), QUESTION.to_string());
        host.ask(&cli, 3, prompt_session("s"), QUESTION.to_string());
        host.ask(&cli, 4, Addressee::Unknown, QUESTION.to_string());

        assert_eq!(
            replies_of(&from_the_cli),
            [
                (1, Err(HostErrorCode::NoAddressee)),
                (2, Err(HostErrorCode::NoAddressee)),
                (3, Err(HostErrorCode::NoAddressee)),
                (4, Err(HostErrorCode::InvalidRequest)),
            ]
        );
        host.shut_down_all();
    }

    #[test]
    fn a_question_whose_answerer_goes_away_fails_and_one_whose_asker_did_is_forgotten() {
        let (office, at_the_office) = client(1);
        let (cli, from_the_cli) = client(2);
        let (gone_cli, _) = client(3);
        let host = host();
        for client in [&office, &cli, &gone_cli] {
            host.client_came(client);
        }
        host.handle(&office, spawn_request("t1", 1, WAITING))
            .unwrap();
        host.ask(&gone_cli, 9, terminal("t1"), QUESTION.to_string());
        host.client_gone(gone_cli.id);
        host.ask(&cli, 7, terminal("t1"), QUESTION.to_string());

        host.client_gone(office.id);

        assert_eq!(asked_of(&at_the_office).len(), 2);
        assert_eq!(
            replies_of(&from_the_cli),
            [(7, Err(HostErrorCode::NoAnswer))]
        );
        host.shut_down_all();
    }

    #[test]
    fn a_prompt_goes_to_the_client_that_owns_its_session() {
        let (first, to_the_first) = client(1);
        let (second, to_the_second) = client(2);
        let (helper, from_the_helper) = client(3);
        let host = host();
        for client in [&first, &second, &helper] {
            host.client_came(client);
        }
        let own = |session: &str| Request::OwnPrompts {
            session: session.to_string(),
        };
        host.handle(&first, own("ssh-1")).unwrap();
        host.handle(&second, own("git-1")).unwrap();
        host.ask(&helper, 1, prompt_session("git-1"), QUESTION.to_string());

        assert!(asked_of(&to_the_first).is_empty());
        assert_eq!(asked_of(&to_the_second)[0].1, prompt_session("git-1"));
        host.handle(
            &second,
            Request::DisownPrompts {
                session: "git-1".to_string(),
            },
        )
        .unwrap();
        host.ask(&helper, 2, prompt_session("git-1"), QUESTION.to_string());
        assert_eq!(
            replies_of(&from_the_helper),
            [(2, Err(HostErrorCode::NoAddressee))]
        );
    }

    #[test]
    fn a_shell_learns_the_endpoint_of_the_host_that_runs_it() {
        #[cfg(windows)]
        const SAYS_HOST: &str = "echo host=[%COGNO_HOST%] & pause";
        #[cfg(unix)]
        const SAYS_HOST: &str = "echo host=[$COGNO_HOST]; read line";
        let (me, sink) = client(1);
        let host = host();
        let mut request = spawn_request("t1", 1, SAYS_HOST);
        if let Request::PtySpawn { options, .. } = &mut request {
            // Wide enough that the path is never wrapped.
            options.size.cols = 400;
        }

        host.handle(&me, request).unwrap();

        let endpoint = std::env::temp_dir()
            .join("cogno-host-test-home")
            .join("host.json");
        let expected = format!("host=[{}]", endpoint.to_string_lossy());
        wait_until("the shell printed its host", || {
            sink.output_of(1).contains(&expected)
        });
        host.shut_down_all();
    }
}
