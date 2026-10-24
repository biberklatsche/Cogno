use crate::commands::askpass::{AskpassState, SESSION_ENV};
use crate::http_server::HttpServerState;
use serde::Serialize;
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// How long output may still arrive after the process ended. A grandchild that
/// inherited the pipes (ssh or a credential helper started by git) keeps them
/// open; the result must not wait for it.
const PIPE_GRACE: Duration = Duration::from_millis(500);

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandRunnerResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Runs on a blocking worker: a slow `git status` must never hold up the
/// thread that drives the UI. `stdin`, when given, is written to the process
/// and closed. The process gets no terminal; whatever it would ask on one
/// (git credentials, an ssh passphrase, a host key) reaches the window that
/// started it through the askpass helper instead, tagged with the caller's
/// `prompt_session` so the window knows which run is asking.
// One parameter per invoke key: that is how a Tauri command takes its arguments.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn command_runner_execute(
    app: AppHandle,
    window: tauri::Window,
    program: String,
    args: Vec<String>,
    cwd: String,
    timeout_ms: Option<u64>,
    stdin: Option<String>,
    prompt_session: String,
) -> Result<CommandRunnerResult, String> {
    let mut command = Command::new(program);
    command.current_dir(cwd).args(args);

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let session_id = prompt_session;
    app.state::<AskpassState>()
        .open_session(&session_id, window.label());
    apply_prompt_environment(&mut command, &app, &session_id);

    let pending = {
        let app = app.clone();
        let session_id = session_id.clone();
        move || app.state::<AskpassState>().has_pending(&session_id)
    };
    let result =
        tauri::async_runtime::spawn_blocking(move || run(command, timeout_ms, stdin, &pending))
            .await;
    app.state::<AskpassState>().close_session(&app, &session_id);

    result
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

/// Git and ssh ask through this binary instead of a terminal. The variables
/// also reach a WSL distro, with the helper path translated (`WSLENV` `/p`).
fn apply_prompt_environment(command: &mut Command, app: &AppHandle, session_id: &str) {
    command.env("GIT_TERMINAL_PROMPT", "0");
    let http = app.state::<HttpServerState>();
    let helper = std::env::current_exe().ok();
    let (Some(helper), true) = (helper, http.port() != 0) else {
        return;
    };
    command.env("GIT_ASKPASS", &helper);
    command.env("SSH_ASKPASS", &helper);
    command.env("SSH_ASKPASS_REQUIRE", "force");
    command.env(SESSION_ENV, session_id);
    command.env("COGNO_PORT", http.port().to_string());
    command.env("COGNO_TOKEN", http.token());
    let shared = [
        "GIT_ASKPASS/p",
        "SSH_ASKPASS/p",
        "SSH_ASKPASS_REQUIRE",
        "GIT_TERMINAL_PROMPT",
        SESSION_ENV,
        "COGNO_PORT",
        "COGNO_TOKEN",
    ]
    .join(":");
    let wslenv = match std::env::var("WSLENV") {
        Ok(existing) if !existing.is_empty() => format!("{existing}:{shared}"),
        _ => shared,
    };
    command.env("WSLENV", wslenv);
}

fn run(
    mut command: Command,
    timeout_ms: Option<u64>,
    stdin: Option<String>,
    prompt_pending: &dyn Fn() -> bool,
) -> std::io::Result<CommandRunnerResult> {
    let mut child = command
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    // Drain both pipes while waiting: a child that writes more than the pipe
    // buffer holds would otherwise block on its write and never exit.
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());
    // Written on its own thread for the same reason: a child that answers
    // before it has read everything must not deadlock against the writer.
    if let (Some(input), Some(mut pipe)) = (stdin, child.stdin.take()) {
        thread::spawn(move || {
            let _ = pipe.write_all(input.as_bytes());
        });
    }

    let status = match timeout_ms.filter(|value| *value > 0) {
        None => Some(child.wait()?),
        Some(timeout_ms) => {
            let timeout = Duration::from_millis(timeout_ms);
            let mut deadline = Instant::now() + timeout;
            loop {
                if let Some(status) = child.try_wait()? {
                    break Some(status);
                }
                // Time the user spends on a prompt does not count.
                if prompt_pending() {
                    deadline = Instant::now() + timeout;
                }
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    break None;
                }
                thread::sleep(Duration::from_millis(10));
            }
        }
    };

    let stdout = String::from_utf8_lossy(&stdout.collect(PIPE_GRACE)).to_string();
    let stderr = String::from_utf8_lossy(&stderr.collect(PIPE_GRACE)).to_string();

    Ok(match status {
        Some(status) => CommandRunnerResult {
            stdout,
            stderr,
            exit_code: status.code().unwrap_or(1),
        },
        None => CommandRunnerResult {
            stdout,
            stderr: if stderr.is_empty() {
                format!(
                    "Command timed out after {}ms",
                    timeout_ms.unwrap_or_default()
                )
            } else {
                stderr
            },
            exit_code: 124,
        },
    })
}

/// A pipe being read on its own thread, so a chatty child never blocks on a
/// full pipe buffer.
struct Drain {
    buffer: Arc<Mutex<Vec<u8>>>,
    finished: mpsc::Receiver<()>,
}

impl Drain {
    /// What was read, once the pipe closed or `grace` passed - whichever comes
    /// first. The reading thread ends by itself when the pipe finally closes.
    fn collect(self, grace: Duration) -> Vec<u8> {
        let _ = self.finished.recv_timeout(grace);
        std::mem::take(
            &mut *self
                .buffer
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner()),
        )
    }
}

fn drain<R: Read + Send + 'static>(pipe: Option<R>) -> Drain {
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let (finished_sender, finished) = mpsc::channel();
    let shared = Arc::clone(&buffer);
    thread::spawn(move || {
        if let Some(mut pipe) = pipe {
            let mut chunk = [0u8; 8192];
            loop {
                match pipe.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(read) => shared
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .extend_from_slice(&chunk[..read]),
                }
            }
        }
        let _ = finished_sender.send(());
    });
    Drain { buffer, finished }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn run(command: Command, timeout_ms: Option<u64>) -> std::io::Result<CommandRunnerResult> {
        super::run(command, timeout_ms, None, &|| false)
    }

    fn shell(script: &str) -> Command {
        let mut command = Command::new("sh");
        command.args(["-c", script]);
        command
    }

    #[test]
    fn output_larger_than_the_pipe_buffer_does_not_run_into_the_timeout() {
        let started = Instant::now();
        let result = run(
            shell("head -c 300000 /dev/zero | tr '\\0' 'x'"),
            Some(5_000),
        )
        .unwrap();

        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout.len(), 300_000);
        assert!(started.elapsed() < Duration::from_secs(4));
    }

    #[test]
    fn a_command_that_outlives_the_timeout_is_killed_and_reports_124() {
        let result = run(shell("exec sleep 5"), Some(100)).unwrap();

        assert_eq!(result.exit_code, 124);
        assert_eq!(result.stderr, "Command timed out after 100ms");
    }

    #[test]
    fn a_grandchild_holding_the_pipes_does_not_hold_up_the_result() {
        let started = Instant::now();
        let result = run(shell("sleep 5 & echo done"), Some(5_000)).unwrap();

        assert_eq!(result.exit_code, 0);
        assert_eq!(
            result.stdout,
            "done
"
        );
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[test]
    fn stdin_is_written_and_closed() {
        let result = super::run(
            shell("cat"),
            Some(5_000),
            Some("from stdin\n".into()),
            &|| false,
        )
        .unwrap();
        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout, "from stdin\n");
    }

    #[test]
    fn exit_code_and_stderr_are_reported() {
        let result = run(shell("echo oops >&2; exit 3"), None).unwrap();

        assert_eq!(result.exit_code, 3);
        assert_eq!(result.stderr, "oops\n");
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;

    #[test]
    fn a_grandchild_holding_the_pipes_does_not_hold_up_the_result() {
        // `start /B` leaves ping running in the background with the inherited
        // pipes after cmd exits.
        let mut command = Command::new("cmd");
        command.args(["/C", "start /B ping -n 6 127.0.0.1 & echo done"]);
        let started = Instant::now();
        let result = run(command, Some(10_000)).unwrap();

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("done"));
        assert!(started.elapsed() < Duration::from_secs(4));
    }
}
