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
    /// stops being delivered.
    fn emit(&self, event: Event) -> bool;
}

pub struct Host {
    pty: PtyState,
    sink: Arc<dyn EventSink>,
}

impl Host {
    pub fn new(sink: Arc<dyn EventSink>) -> Self {
        Self {
            pty: PtyState::new(),
            sink,
        }
    }

    /// Answers one request. Some answers take a while (starting a shell,
    /// closing a ConPTY, walking the machine's processes): never call this on
    /// a thread that must not block.
    pub fn handle(&self, request: Request) -> Reply {
        match request {
            Request::PtySpawn {
                options,
                owner,
                stream,
                env,
            } => self
                .pty
                .spawn(options, owner, stream, env, self.sink.clone())
                .map(Response::Spawned),
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
                self.pty.release_owner(&owner);
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

    /// A spawn of the platform's plain shell running `script`, without
    /// integration.
    fn spawn_request(terminal_id: &str, stream: u64, script: &str) -> Request {
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
        }
    }

    #[test]
    fn a_session_sends_its_output_under_its_stream_and_a_kill_ends_it_without_an_exit() {
        // The shell waits for input itself: a child process of its own could
        // outlive the kill and keep the console, and with it the stream, open.
        #[cfg(windows)]
        let script = "echo port=%COGNO_PORT% & pause";
        #[cfg(unix)]
        let script = "echo port=$COGNO_PORT; read line";
        let sink = Arc::new(RecordingSink::default());
        let host = Host::new(sink.clone());

        let spawned = host.handle(spawn_request("t1", 7, script));
        assert!(matches!(spawned, Ok(Response::Spawned(_))));
        assert_eq!(host.owner_of("t1").as_deref(), Some("window-1"));
        // The caller's environment reached the shell.
        wait_until("the shell printed the port", || {
            sink.output_of(7).contains("port=4711")
        });

        assert!(host
            .handle(Request::PtyKill {
                terminal_id: "t1".to_string()
            })
            .is_ok());
        wait_until("the stream ended", || {
            sink.0.lock().unwrap().ended_streams == [7]
        });
        assert_eq!(host.owner_of("t1"), None);
        assert!(sink.0.lock().unwrap().exits.is_empty());
    }

    #[test]
    fn a_shell_that_ends_on_its_own_reports_its_exit_to_its_owner() {
        let sink = Arc::new(RecordingSink::default());
        let host = Host::new(sink.clone());

        let spawned = host.handle(spawn_request("t2", 1, "exit 3"));
        assert!(matches!(spawned, Ok(Response::Spawned(_))));
        wait_until("the exit was reported", || {
            !sink.0.lock().unwrap().exits.is_empty()
        });

        let exits = sink.0.lock().unwrap().exits.clone();
        assert_eq!(exits, [("t2".to_string(), "window-1".to_string())]);
        host.release_all();
    }
}
