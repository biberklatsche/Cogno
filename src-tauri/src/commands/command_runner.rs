use serde::Serialize;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

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
    let mut child = Command::new(program)
        .current_dir(cwd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    if let Some(timeout_ms) = timeout_ms.filter(|value| *value > 0) {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        loop {
            if child.try_wait().map_err(|error| error.to_string())?.is_some() {
                break;
            }

            if Instant::now() >= deadline {
                let _ = child.kill();
                let output = child.wait_with_output().map_err(|error| error.to_string())?;
                return Ok(CommandRunnerResult {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: if output.stderr.is_empty() {
                        format!("Command timed out after {timeout_ms}ms")
                    } else {
                        String::from_utf8_lossy(&output.stderr).to_string()
                    },
                    exit_code: 124,
                });
            }

            thread::sleep(Duration::from_millis(10));
        }
    }

    let output = child.wait_with_output().map_err(|error| error.to_string())?;

    Ok(CommandRunnerResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(1),
    })
}
