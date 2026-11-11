//! `cogno server --stdio`, spoken to the way a Cogno on another machine does
//! through ssh: the real binary behind two pipes.

use cogno_host::protocol::{Event, Request, Response, ShellProfile, SpawnOptions};
use cogno_host::wire::{self, HostMessage, RequestEnvelope, PROTOCOL_VERSION};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::time::{Duration, Instant};

const PATIENCE: Duration = Duration::from_secs(20);

struct Server {
    process: Child,
    stdin: Option<ChildStdin>,
    messages: Receiver<HostMessage>,
    next_id: u64,
}

impl Server {
    /// Starts the server and reads up to its hello.
    fn start() -> (Self, HostMessage) {
        let mut process = Command::new(env!("CARGO_BIN_EXE_cogno"))
            .args(["server", "--stdio"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let stdin = process.stdin.take();
        let mut stdout = process.stdout.take().unwrap();
        let (sender, messages) = mpsc::channel();
        std::thread::spawn(move || {
            if wire::skip_to_preamble(&mut stdout).is_err() {
                return;
            }
            while let Ok(Some(message)) = wire::read_host_message(&mut stdout) {
                if sender.send(message).is_err() {
                    return;
                }
            }
        });
        let mut server = Self {
            process,
            stdin,
            messages,
            next_id: 1,
        };
        let hello = server.next_message("the hello");
        (server, hello)
    }

    fn next_message(&mut self, what: &str) -> HostMessage {
        self.messages
            .recv_timeout(PATIENCE)
            .unwrap_or_else(|_| panic!("the server never sent {what}"))
    }

    /// Sends a request and returns its reply; whatever else arrives before it
    /// is handed to `other`.
    fn request(
        &mut self,
        request: Request,
        mut other: impl FnMut(HostMessage),
    ) -> Result<Response, String> {
        let id = self.next_id;
        self.next_id += 1;
        wire::write_request(
            self.stdin.as_mut().unwrap(),
            &RequestEnvelope { id, request },
        )
        .unwrap();
        loop {
            match self.next_message("the reply") {
                HostMessage::Reply { id: replied, reply } if replied == id => return reply,
                message => other(message),
            }
        }
    }

    /// Hangs up, as a lost connection does, and waits for the server to end.
    fn hang_up(mut self) -> bool {
        drop(self.stdin.take());
        let started = Instant::now();
        while started.elapsed() < PATIENCE {
            if let Some(status) = self.process.try_wait().unwrap() {
                return status.success();
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let _ = self.process.kill();
        panic!("the server kept running after its client hung up");
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.process.kill();
    }
}

/// The platform's plain shell printing `ready` and then waiting for input.
fn waiting_shell(terminal_id: &str, stream: u64) -> Request {
    #[cfg(windows)]
    let (shell_type, path, args) = ("PowerShell", "cmd.exe", ["/C", "echo ready & set /p line="]);
    #[cfg(unix)]
    let (shell_type, path, args) = ("Bash", "/bin/sh", ["-c", "echo ready; read line"]);
    Request::PtySpawn {
        options: SpawnOptions {
            name: terminal_id.to_string(),
            cols: 80,
            rows: 24,
            profile: ShellProfile {
                shell_type: shell_type.to_string(),
                path: Some(path.to_string()),
                args: Some(args.map(str::to_string).to_vec()),
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
        env: Vec::new(),
    }
}

/// Reads messages until the output under `stream` contains `text`.
fn wait_for_output(server: &mut Server, stream: u64, text: &str, mut seen: Vec<u8>) {
    while !String::from_utf8_lossy(&seen).contains(text) {
        if let HostMessage::Event(Event::PtyData { stream: of, frame }) =
            server.next_message("the shell's output")
        {
            assert_eq!(of, stream);
            // Past the chunk's sequence number.
            seen.extend_from_slice(&frame[4..]);
        }
    }
}

fn is_running(process_id: u32) -> bool {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
    let pid = Pid::from_u32(process_id);
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::nothing(),
    );
    system.process(pid).is_some()
}

#[test]
fn the_server_introduces_itself_and_answers_requests() {
    let (mut server, hello) = Server::start();
    assert!(matches!(
        hello,
        HostMessage::Hello { protocol: PROTOCOL_VERSION, os } if os == std::env::consts::OS
    ));

    let shells = server.request(Request::ListShells, |_| {});
    assert!(matches!(shells, Ok(Response::Shells(_))));
    let unknown = server.request(
        Request::PtyResize {
            terminal_id: "nobody".into(),
            cols: 80,
            rows: 24,
        },
        |_| {},
    );
    assert_eq!(unknown.unwrap_err(), "Session not found: nobody");

    assert!(server.hang_up());
}

#[test]
fn a_shell_runs_behind_the_server_takes_input_and_reports_its_end() {
    let (mut server, _hello) = Server::start();

    let mut early_output = Vec::new();
    let spawned = server.request(waiting_shell("t1", 5), |message| {
        if let HostMessage::Event(Event::PtyData { frame, .. }) = message {
            early_output.extend_from_slice(&frame[4..]);
        }
    });
    assert!(matches!(spawned, Ok(Response::Spawned(_))));
    wait_for_output(&mut server, 5, "ready", early_output);

    // A line ends the wait, and with it the shell. Its exit may overtake
    // the reply to the write.
    fn exit_of(message: HostMessage) -> Option<(String, String)> {
        match message {
            HostMessage::Event(Event::PtyExit {
                terminal_id, owner, ..
            }) => Some((terminal_id, owner)),
            _ => None,
        }
    }
    let mut exit = None;
    let written = server.request(
        Request::PtyWrite {
            terminal_id: "t1".into(),
            data: "x\r".into(),
        },
        |message| exit = exit.take().or(exit_of(message)),
    );
    assert!(written.is_ok());
    while exit.is_none() {
        exit = exit_of(server.next_message("the shell's exit"));
    }
    assert_eq!(exit, Some(("t1".to_string(), "window-1".to_string())));

    assert!(server.hang_up());
}

#[test]
fn a_client_that_hangs_up_takes_its_shells_along() {
    let (mut server, _hello) = Server::start();

    let spawned = server.request(waiting_shell("t1", 1), |_| {});
    let Ok(Response::Spawned(result)) = spawned else {
        panic!("the shell did not start: {spawned:?}");
    };
    let shell = result.shell_process_id.unwrap();
    assert!(is_running(shell));

    assert!(server.hang_up());
    let started = Instant::now();
    while is_running(shell) {
        assert!(
            started.elapsed() < PATIENCE,
            "the shell outlived the server"
        );
        std::thread::sleep(Duration::from_millis(50));
    }
}
