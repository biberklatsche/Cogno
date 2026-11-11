use crate::commands::askpass::{point_ssh_at_helper, AskpassState, SESSION_ENV};
use crate::http_server::HttpServerState;
use serde::Serialize;
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
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
use cogno_host::process_job::ProcessJob;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
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
/// `prompt_session` so the window knows which run is asking. `timeout_ms`
/// is idle time: the process is ended once it has neither produced output
/// nor had a prompt open for that long, so a transfer that reports progress
/// may take as long as it takes.
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
    let askpass_token = app
        .state::<AskpassState>()
        .open_session(&session_id, window.label());
    // Bounded like the shell spawn: the login shell is normally captured long
    // before the first run; if it hangs, run with the process PATH instead.
    let login_path =
        cogno_host::login_environment::get_login_environment(Duration::from_secs(2)).path;
    apply_runner_environment(&mut command, login_path);
    apply_prompt_environment(&mut command, &app, &session_id, &askpass_token);

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

/// What every run gets. The login PATH: a GUI process started by launchd or
/// systemd has a minimal one, so git, gh or a credential helper configured by
/// name would not be found, or Apple's /usr/bin/git shim would be taken over
/// the git the user's terminal uses. `GIT_OPTIONAL_LOCKS=0`: a read such as
/// `git status` otherwise rewrites the index under index.lock and collides
/// with a git command the user types in the pane at that moment.
fn apply_runner_environment(command: &mut Command, login_path: Option<String>) {
    if let Some(path) = login_path {
        command.env("PATH", path);
    }
    command.env("GIT_OPTIONAL_LOCKS", "0");
}

/// Git and ssh ask through this binary instead of a terminal. The variables
/// also reach a WSL distro, with the helper path translated (`WSLENV` `/p`).
/// `COGNO_TOKEN` is the run's askpass token, not the launch token: hooks and
/// helpers git starts inherit this environment (`askpass.rs`).
fn apply_prompt_environment(
    command: &mut Command,
    app: &AppHandle,
    session_id: &str,
    askpass_token: &str,
) {
    command.env("GIT_TERMINAL_PROMPT", "0");
    let port = app.state::<HttpServerState>().port();
    let Some(helper) = point_ssh_at_helper(command, port, session_id, askpass_token) else {
        return;
    };
    command.env("GIT_ASKPASS", &helper);
    let shared = [
        "GIT_ASKPASS/p",
        "SSH_ASKPASS/p",
        "SSH_ASKPASS_REQUIRE",
        "GIT_TERMINAL_PROMPT",
        "GIT_OPTIONAL_LOCKS",
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
    // In a process group of its own, so a timeout ends everything the
    // command started and not just the command: git's ssh, a credential
    // helper waiting on a browser, a hook. Windows uses a job object for it.
    #[cfg(unix)]
    command.process_group(0);
    let mut child = command
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    // A command that cannot join a job (a restricted job around Cogno
    // itself) still runs; a timeout then ends the command alone.
    #[cfg(windows)]
    let job = match ProcessJob::tracking(child.id()) {
        Ok(job) => Some(job),
        Err(error) => {
            log::warn!(
                target: "command_runner",
                "pid={} could not join a job object: {}",
                child.id(),
                error
            );
            None
        }
    };

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
            let mut idle =
                IdleDeadline::starting(Instant::now(), Duration::from_millis(timeout_ms));
            loop {
                if let Some(status) = child.try_wait()? {
                    break Some(status);
                }
                let received = stdout.received() + stderr.received();
                if idle.expired(Instant::now(), received, prompt_pending()) {
                    // The group's id is the child's (process_group(0)).
                    #[cfg(unix)]
                    unsafe {
                        libc::kill(-(child.id() as i32), libc::SIGKILL);
                    }
                    #[cfg(windows)]
                    if let Some(job) = &job {
                        job.terminate();
                    }
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
                    "Command showed no output for {}ms and was ended",
                    timeout_ms.unwrap_or_default()
                )
            } else {
                stderr
            },
            exit_code: 124,
        },
    })
}

/// When a silent command is ended. Neither time the user spends on a prompt
/// nor time the command spends talking counts: only silence does. The caller
/// says what time it is, so the rule holds without a clock.
struct IdleDeadline {
    timeout: Duration,
    deadline: Instant,
    /// Bytes the command had produced when it was last heard from.
    seen: u64,
}

impl IdleDeadline {
    fn starting(now: Instant, timeout: Duration) -> Self {
        Self {
            timeout,
            deadline: now + timeout,
            seen: 0,
        }
    }

    /// Whether the command has been silent for the whole timeout at `now`.
    /// `received` is every byte it has produced so far.
    fn expired(&mut self, now: Instant, received: u64, prompt_pending: bool) -> bool {
        if prompt_pending || received != self.seen {
            self.seen = received;
            self.deadline = now + self.timeout;
        }
        now >= self.deadline
    }
}

/// A pipe being read on its own thread, so a chatty child never blocks on a
/// full pipe buffer.
struct Drain {
    buffer: Arc<Mutex<Vec<u8>>>,
    /// Bytes read so far; the idle timeout watches it move.
    received: Arc<AtomicU64>,
    finished: mpsc::Receiver<()>,
}

impl Drain {
    fn received(&self) -> u64 {
        self.received.load(Ordering::Relaxed)
    }

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
    let received = Arc::new(AtomicU64::new(0));
    let (finished_sender, finished) = mpsc::channel();
    let shared = Arc::clone(&buffer);
    let counted = Arc::clone(&received);
    thread::spawn(move || {
        if let Some(mut pipe) = pipe {
            let mut chunk = [0u8; 8192];
            loop {
                match pipe.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(read) => {
                        shared
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner())
                            .extend_from_slice(&chunk[..read]);
                        counted.fetch_add(read as u64, Ordering::Relaxed);
                    }
                }
            }
        }
        let _ = finished_sender.send(());
    });
    Drain {
        buffer,
        received,
        finished,
    }
}

#[cfg(test)]
mod idle_deadline_tests {
    use super::*;

    const TIMEOUT: Duration = Duration::from_millis(300);

    fn after(start: Instant, millis: u64) -> Instant {
        start + Duration::from_millis(millis)
    }

    #[test]
    fn a_silent_command_expires_once_the_timeout_has_passed() {
        let start = Instant::now();
        let mut idle = IdleDeadline::starting(start, TIMEOUT);

        assert!(!idle.expired(after(start, 299), 0, false));
        assert!(idle.expired(after(start, 300), 0, false));
    }

    #[test]
    fn output_starts_the_wait_anew() {
        let start = Instant::now();
        let mut idle = IdleDeadline::starting(start, TIMEOUT);

        assert!(!idle.expired(after(start, 250), 10, false));
        // Past the first deadline, but not yet silent for the whole timeout.
        assert!(!idle.expired(after(start, 549), 10, false));
        assert!(idle.expired(after(start, 550), 10, false));
    }

    #[test]
    fn steady_output_keeps_a_command_alive_far_past_the_timeout() {
        let start = Instant::now();
        let mut idle = IdleDeadline::starting(start, TIMEOUT);

        for step in 1..=100 {
            assert!(!idle.expired(after(start, step * 200), step, false));
        }
    }

    #[test]
    fn an_open_prompt_starts_the_wait_anew_without_output() {
        let start = Instant::now();
        let mut idle = IdleDeadline::starting(start, TIMEOUT);

        assert!(!idle.expired(after(start, 10_000), 0, true));
        // The answer is in: from here on silence counts again.
        assert!(!idle.expired(after(start, 10_299), 0, false));
        assert!(idle.expired(after(start, 10_300), 0, false));
    }
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
        assert_eq!(
            result.stderr,
            "Command showed no output for 100ms and was ended"
        );
    }

    #[test]
    fn an_open_prompt_keeps_a_silent_command_alive_past_the_timeout() {
        let result = super::run(shell("sleep 0.3"), Some(50), None, &|| true).unwrap();

        assert_eq!(result.exit_code, 0);
    }

    #[test]
    fn a_timed_out_command_takes_what_it_started_with_it() {
        let result = run(shell("sleep 30 & echo $!; wait"), Some(200)).unwrap();

        assert_eq!(result.exit_code, 124);
        let pid: i32 = result.stdout.trim().parse().unwrap();
        let gone = (0..60).any(|_| {
            if unsafe { libc::kill(pid, 0) } != 0 {
                return true;
            }
            thread::sleep(Duration::from_millis(50));
            false
        });
        assert!(gone, "the background sleep outlived the timeout");
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

    #[test]
    fn the_login_path_and_optional_locks_reach_the_command() {
        let mut command = shell("echo \"$PATH\"; echo \"$GIT_OPTIONAL_LOCKS\"");
        apply_runner_environment(&mut command, Some("/cogno/login/bin:/usr/bin:/bin".into()));

        let result = run(command, Some(5_000)).unwrap();

        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout, "/cogno/login/bin:/usr/bin:/bin\n0\n");
    }

    #[test]
    fn without_a_login_path_the_process_path_stays() {
        let mut command = shell("echo \"$PATH\"");
        apply_runner_environment(&mut command, None);

        let result = run(command, Some(5_000)).unwrap();

        assert_eq!(result.stdout.trim_end(), std::env::var("PATH").unwrap());
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use sysinfo::{ProcessesToUpdate, System};

    fn ping_with(marker: &str) -> bool {
        let mut system = System::new();
        system.refresh_processes(ProcessesToUpdate::All, true);
        system.processes().values().any(|process| {
            process
                .cmd()
                .iter()
                .any(|argument| argument.to_string_lossy().contains(marker))
        })
    }

    #[test]
    fn a_timed_out_command_takes_what_it_started_with_it() {
        // The pings start after the command joined the job; `start /B`
        // leaves the first one running on its own.
        let marker = "54321";
        let mut command = Command::new("cmd");
        command.args([
            "/C",
            "ping -n 2 127.0.0.1 >nul & start /B ping -n 30 -w 54321 127.0.0.1 >nul & ping -n 30 -w 54321 127.0.0.1 >nul",
        ]);
        let result = run(command, Some(1_500), None, &|| false).unwrap();

        assert_eq!(result.exit_code, 124);
        let gone = (0..100).any(|_| {
            if !ping_with(marker) {
                return true;
            }
            thread::sleep(Duration::from_millis(50));
            false
        });
        assert!(gone, "what the command started outlived the timeout");
    }

    #[test]
    fn optional_locks_reach_the_command() {
        let mut command = Command::new("cmd");
        command.args(["/C", "echo %GIT_OPTIONAL_LOCKS%"]);
        apply_runner_environment(&mut command, None);

        let result = run(command, Some(5_000), None, &|| false).unwrap();

        assert_eq!(result.stdout.trim_end(), "0");
    }

    #[test]
    fn a_grandchild_holding_the_pipes_does_not_hold_up_the_result() {
        // `start /B` leaves ping running in the background with the inherited
        // pipes after cmd exits.
        let mut command = Command::new("cmd");
        command.args(["/C", "start /B ping -n 6 127.0.0.1 & echo done"]);
        let started = Instant::now();
        let result = run(command, Some(10_000), None, &|| false).unwrap();

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("done"));
        assert!(started.elapsed() < Duration::from_secs(4));
    }
}
