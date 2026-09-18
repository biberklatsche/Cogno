use serde::Serialize;
use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

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

#[tauri::command]
pub fn command_runner_execute(
    program: String,
    args: Vec<String>,
    cwd: String,
    timeout_ms: Option<u64>,
) -> Result<CommandRunnerResult, String> {
    let mut command = Command::new(program);
    command.current_dir(cwd).args(args);

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    run(command, timeout_ms).map_err(|error| error.to_string())
}

fn run(mut command: Command, timeout_ms: Option<u64>) -> std::io::Result<CommandRunnerResult> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    // Drain both pipes while waiting: a child that writes more than the pipe
    // buffer holds would otherwise block on its write and never exit.
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());

    let status = match timeout_ms.filter(|value| *value > 0) {
        None => Some(child.wait()?),
        Some(timeout_ms) => {
            let deadline = Instant::now() + Duration::from_millis(timeout_ms);
            loop {
                if let Some(status) = child.try_wait()? {
                    break Some(status);
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

    let stdout = String::from_utf8_lossy(&stdout.join().unwrap_or_default()).to_string();
    let stderr = String::from_utf8_lossy(&stderr.join().unwrap_or_default()).to_string();

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

fn drain<R: Read + Send + 'static>(pipe: Option<R>) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_end(&mut buffer);
        }
        buffer
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

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
    fn exit_code_and_stderr_are_reported() {
        let result = run(shell("echo oops >&2; exit 3"), None).unwrap();

        assert_eq!(result.exit_code, 3);
        assert_eq!(result.stderr, "oops\n");
    }
}
