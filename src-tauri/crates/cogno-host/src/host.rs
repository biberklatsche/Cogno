use std::sync::Arc;

use crate::processes::{
    get_process_tree_snapshot, list_terminal_processes, terminate_process_tree,
};
use crate::protocol::{Event, Reply, Request, Response};
use crate::pty::PtyState;
use crate::shell_integration;
use crate::shells::detect_shells;

/// Where a host's events go.
pub trait EventSink: Send + Sync + 'static {
    /// False when nobody takes the event any more; a session's output then
    /// stops being sent there.
    fn emit(&self, event: Event) -> bool;
}

/// Who talks to the host: one connection, or the app that embeds it.
#[derive(Clone)]
pub struct Client {
    /// Tells the host's clients apart; never used again for another one.
    pub id: u64,
    /// Where what this client's sessions report goes.
    pub sink: Arc<dyn EventSink>,
}

#[derive(Default)]
pub struct Host {
    pty: PtyState,
}

impl Host {
    pub fn new() -> Self {
        Self::default()
    }

    /// Answers one request of `client`. Some answers take a while (starting
    /// a shell, closing a ConPTY, walking the machine's processes): never
    /// call this on a thread that must not block.
    pub fn handle(&self, client: &Client, request: Request) -> Reply {
        match request {
            Request::PtySpawn {
                options,
                owner,
                stream,
                env,
                survives_client,
            } => self
                .pty
                .spawn(client, options, owner, stream, env, survives_client)
                .map(Response::Spawned),
            Request::PtyAttach {
                terminal_id,
                owner,
                stream,
            } => self
                .pty
                .attach(client, &terminal_id, owner, stream)
                .map(|_| Response::Done),
            Request::PtyDetach { terminal_id } => {
                self.pty.detach(&terminal_id).map(|_| Response::Done)
            }
            Request::ListSessions => Ok(Response::Sessions(self.pty.list())),
            Request::PtyWrite { terminal_id, data } => {
                self.pty.write(&terminal_id, data).map(|_| Response::Done)
            }
            Request::PtyLineEditorAction {
                terminal_id,
                action,
                payload_json,
            } => self
                .pty
                .execute_line_editor_action(&terminal_id, &action, payload_json.as_deref())
                .map(|_| Response::Done),
            Request::PtyResize {
                terminal_id,
                cols,
                rows,
            } => self
                .pty
                .resize(&terminal_id, cols, rows)
                .map(|_| Response::Done),
            Request::PtyKill { terminal_id } => self.pty.kill(&terminal_id).map(|_| Response::Done),
            Request::PtyAck { terminal_id, seq } => {
                self.pty.ack(&terminal_id, seq);
                Ok(Response::Done)
            }
            Request::ReleaseOwner { owner } => {
                self.pty.release_owner(client.id, &owner);
                Ok(Response::Done)
            }
            Request::ProcessTree { terminal_id } => {
                get_process_tree_snapshot(self.shell_process_id(&terminal_id)?)
                    .map(Response::ProcessTree)
            }
            Request::TerminalProcesses => Ok(Response::TerminalProcesses(list_terminal_processes(
                &self.pty.shell_process_ids(),
            ))),
            Request::TerminateProcess {
                terminal_id,
                process_id,
            } => terminate_process_tree(self.shell_process_id(&terminal_id)?, process_id)
                .map(|_| Response::Done),
            Request::ListShells => Ok(Response::Shells(detect_shells())),
            Request::InstallShellIntegration {
                dev_mode,
                version,
                files,
            } => shell_integration::install(dev_mode, &version, &files).map(|_| Response::Done),
        }
    }

    /// The client is gone, for whatever reason. Its sessions end with it,
    /// except those started to go on without one.
    pub fn client_gone(&self, client: u64) {
        self.pty.client_gone(client);
    }

    /// Whom the terminal belongs to, as its spawn named it.
    pub fn owner_of(&self, terminal_id: &str) -> Option<String> {
        self.pty.owner_of(terminal_id)
    }

    /// Ends every shell: what the embedding process does on its way out.
    pub fn release_all(&self) {
        self.pty.release_all();
    }

    fn shell_process_id(&self, terminal_id: &str) -> Result<u32, String> {
        self.pty.get_shell_process_id(terminal_id).ok_or_else(|| {
            format!(
                "No shell process id found for terminal session: {}",
                terminal_id
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ShellProfile, SpawnOptions};
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    #[derive(Default)]
    struct Recorded {
        /// Output bytes by stream, without the sequence header.
        output: Vec<(u64, Vec<u8>)>,
        ended_streams: Vec<u64>,
        /// Terminal id and owner of every reported exit.
        exits: Vec<(String, String)>,
        /// Terminal id and owner of every session taken over.
        taken_over: Vec<(String, String)>,
    }

    #[derive(Default)]
    struct RecordingSink(Mutex<Recorded>);

    impl EventSink for RecordingSink {
        fn emit(&self, event: Event) -> bool {
            let mut recorded = self.0.lock().unwrap();
            match event {
                Event::PtyData { stream, frame } => {
                    recorded.output.push((stream, frame[4..].to_vec()))
                }
                Event::PtyStreamEnded { stream } => recorded.ended_streams.push(stream),
                Event::PtyExit {
                    terminal_id, owner, ..
                } => recorded.exits.push((terminal_id, owner)),
                Event::PtyTakenOver { terminal_id, owner } => {
                    recorded.taken_over.push((terminal_id, owner))
                }
            }
            true
        }
    }

    impl RecordingSink {
        fn output_of(&self, stream: u64) -> String {
            let recorded = self.0.lock().unwrap();
            let bytes: Vec<u8> = recorded
                .output
                .iter()
                .filter(|(of, _)| *of == stream)
                .flat_map(|(_, bytes)| bytes.clone())
                .collect();
            String::from_utf8_lossy(&bytes).to_string()
        }

        fn ended_streams(&self) -> Vec<u64> {
            self.0.lock().unwrap().ended_streams.clone()
        }
    }

    /// A client of its own, and what the host sent it.
    fn client(id: u64) -> (Client, Arc<RecordingSink>) {
        let sink = Arc::new(RecordingSink::default());
        (
            Client {
                id,
                sink: sink.clone(),
            },
            sink,
        )
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

    /// The shell prints `port=<COGNO_PORT>` and waits for input itself: a
    /// child process of its own could outlive a kill and keep the console,
    /// and with it the stream, open.
    #[cfg(windows)]
    const WAITING: &str = "echo port=%COGNO_PORT% & pause";
    #[cfg(unix)]
    const WAITING: &str = "echo port=$COGNO_PORT; read line";

    /// The shell prints `first`, a moment later `second`, and then waits.
    #[cfg(windows)]
    const TWO_LINES: &str = "echo first & ping -n 2 127.0.0.1 >nul & echo second & pause";
    #[cfg(unix)]
    const TWO_LINES: &str = "echo first; sleep 1; echo second; read line";

    /// A spawn of the platform's plain shell running `script`, without
    /// integration.
    fn spawn_request(terminal_id: &str, stream: u64, script: &str, survives: bool) -> Request {
        #[cfg(windows)]
        let (shell_type, path, flag) = ("PowerShell", "cmd.exe", "/C");
        #[cfg(unix)]
        let (shell_type, path, flag) = ("Bash", "/bin/sh", "-c");
        Request::PtySpawn {
            options: SpawnOptions {
                name: terminal_id.to_string(),
                cols: 80,
                rows: 24,
                profile: ShellProfile {
                    shell_type: shell_type.to_string(),
                    path: Some(path.to_string()),
                    args: Some(vec![flag.to_string(), script.to_string()]),
                    env: None,
                    working_dir: Some(std::env::temp_dir().to_string_lossy().to_string()),
                    enable_shell_integration: Some(false),
                    inject_cogno_cli: Some(false),
                    load_user_rc: None,
                },
                dev_mode: Some(true),
            },
            owner: "window-1".to_string(),
            stream,
            env: vec![("COGNO_PORT".to_string(), "4711".to_string())],
            survives_client: survives,
        }
    }

    fn attach_request(terminal_id: &str, stream: u64) -> Request {
        Request::PtyAttach {
            terminal_id: terminal_id.to_string(),
            owner: "window-1".to_string(),
            stream,
        }
    }

    fn sessions_of(host: &Host, client: &Client) -> Vec<(String, bool)> {
        match host.handle(client, Request::ListSessions) {
            Ok(Response::Sessions(sessions)) => sessions
                .into_iter()
                .map(|session| (session.terminal_id, session.attached))
                .collect(),
            other => panic!("no session list: {other:?}"),
        }
    }

    #[test]
    fn a_session_sends_its_output_under_its_stream_and_a_kill_ends_it_without_an_exit() {
        let (me, sink) = client(1);
        let host = Host::new();

        let spawned = host.handle(&me, spawn_request("t1", 7, WAITING, false));
        assert!(matches!(spawned, Ok(Response::Spawned(_))));
        assert_eq!(host.owner_of("t1").as_deref(), Some("window-1"));
        // The caller's environment reached the shell.
        wait_until("the shell printed the port", || {
            sink.output_of(7).contains("port=4711")
        });

        assert!(host
            .handle(
                &me,
                Request::PtyKill {
                    terminal_id: "t1".to_string()
                }
            )
            .is_ok());
        wait_until("the stream ended", || sink.ended_streams() == [7]);
        assert_eq!(host.owner_of("t1"), None);
        assert!(sink.0.lock().unwrap().exits.is_empty());
    }

    #[test]
    fn a_shell_that_ends_on_its_own_reports_its_exit_to_its_owner() {
        let (me, sink) = client(1);
        let host = Host::new();

        let spawned = host.handle(&me, spawn_request("t2", 1, "exit 3", false));
        assert!(matches!(spawned, Ok(Response::Spawned(_))));
        wait_until("the exit was reported", || {
            !sink.0.lock().unwrap().exits.is_empty()
        });

        let exits = sink.0.lock().unwrap().exits.clone();
        assert_eq!(exits, [("t2".to_string(), "window-1".to_string())]);
        host.release_all();
    }

    #[test]
    fn a_session_goes_on_without_its_client_and_the_next_one_gets_what_it_missed() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = client(2);
        let host = Host::new();
        host.handle(&office, spawn_request("t1", 1, TWO_LINES, true))
            .unwrap();
        wait_until("the first line was printed", || {
            at_the_office.output_of(1).contains("first")
        });

        // The office closes before the shell prints its second line.
        host.client_gone(office.id);
        assert_eq!(sessions_of(&host, &laptop), [("t1".to_string(), false)]);

        host.handle(&laptop, attach_request("t1", 9)).unwrap();
        wait_until("the laptop has both lines", || {
            let output = on_the_laptop.output_of(9);
            output.contains("first") && output.contains("second")
        });
        assert_eq!(sessions_of(&host, &laptop), [("t1".to_string(), true)]);
        assert!(!at_the_office.output_of(1).contains("second"));
        host.release_all();
    }

    #[test]
    fn a_session_that_does_not_go_on_ends_with_its_client() {
        let (me, _sink) = client(1);
        let (other, _) = client(2);
        let host = Host::new();
        host.handle(&me, spawn_request("t1", 1, WAITING, false))
            .unwrap();
        host.handle(&other, spawn_request("t2", 1, WAITING, false))
            .unwrap();

        host.client_gone(me.id);

        // Only the client that is gone loses its session.
        assert_eq!(sessions_of(&host, &other), [("t2".to_string(), true)]);
        host.release_all();
    }

    #[test]
    fn a_second_client_takes_a_session_over_and_the_first_is_told() {
        let (office, at_the_office) = client(1);
        let (laptop, on_the_laptop) = client(2);
        let host = Host::new();
        host.handle(&office, spawn_request("t1", 1, WAITING, true))
            .unwrap();
        wait_until("the shell printed the port", || {
            at_the_office.output_of(1).contains("port=4711")
        });

        host.handle(&laptop, attach_request("t1", 5)).unwrap();

        wait_until("the laptop has the output so far", || {
            on_the_laptop.output_of(5).contains("port=4711")
        });
        assert_eq!(at_the_office.ended_streams(), [1]);
        assert_eq!(
            at_the_office.0.lock().unwrap().taken_over,
            [("t1".to_string(), "window-1".to_string())]
        );
        // It is the laptop's now: the office going away changes nothing.
        host.client_gone(office.id);
        assert_eq!(sessions_of(&host, &laptop), [("t1".to_string(), true)]);
        host.release_all();
    }

    #[test]
    fn a_client_can_let_go_of_a_session_and_come_back_to_it() {
        let (me, sink) = client(1);
        let host = Host::new();
        host.handle(&me, spawn_request("t1", 1, WAITING, true))
            .unwrap();
        wait_until("the shell printed the port", || {
            sink.output_of(1).contains("port=4711")
        });

        let detached = host.handle(
            &me,
            Request::PtyDetach {
                terminal_id: "t1".to_string(),
            },
        );
        assert!(detached.is_ok());
        assert_eq!(sink.ended_streams(), [1]);
        assert_eq!(sessions_of(&host, &me), [("t1".to_string(), false)]);

        host.handle(&me, attach_request("t1", 2)).unwrap();
        wait_until("the output came again", || {
            sink.output_of(2).contains("port=4711")
        });
        // Nobody was taken over: the session had no client.
        assert!(sink.0.lock().unwrap().taken_over.is_empty());
        host.release_all();
    }

    #[test]
    fn attaching_to_a_session_that_is_not_there_fails() {
        let (me, _sink) = client(1);
        let host = Host::new();

        let attached = host.handle(&me, attach_request("nobody", 1));
        assert_eq!(attached.unwrap_err(), "Session not found: nobody");
    }

    #[test]
    fn two_clients_can_name_their_owners_alike() {
        let (first, _) = client(1);
        let (second, _) = client(2);
        let host = Host::new();

        // The first client's window "window-1" is closed for good ...
        host.handle(
            &first,
            Request::ReleaseOwner {
                owner: "window-1".to_string(),
            },
        )
        .unwrap();
        // ... which is not the second client's window of that name.
        let spawned = host.handle(&second, spawn_request("t1", 1, WAITING, false));
        assert!(matches!(spawned, Ok(Response::Spawned(_))));
        // The first client's own late spawn is still refused.
        let late = host.handle(&first, spawn_request("t2", 1, WAITING, false));
        assert!(late.is_err());
        host.release_all();
    }
}
