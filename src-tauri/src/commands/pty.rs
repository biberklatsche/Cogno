use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

use super::shell_spawner::{ShellProfile, ShellSpawner};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub name: String,
    pub cols: u16,
    pub rows: u16,
    pub profile: ShellProfile,
    pub dev_mode: Option<bool>,
}

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    should_exit: Arc<AtomicBool>,
    shell_process_id: Option<u32>,
    shell_type: String,
    line_editor_pipe_name: Option<String>,
}

pub struct PtyState {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_shell_process_id(&self, terminal_id: &str) -> Option<u32> {
        let sessions = self.sessions.lock().ok()?;
        sessions
            .get(terminal_id)
            .and_then(|session| session.shell_process_id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySpawnResult {
    pub shell_process_id: Option<u32>,
}

#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    options: SpawnOptions,
) -> Result<PtySpawnResult, String> {
    let terminal_id = options.name.clone();

    // Prepare shell spawn with integration
    let dev_mode = options.dev_mode.unwrap_or(false);
    let spawner = ShellSpawner::new(dev_mode)?;
    let (program, args, env, working_dir) = spawner.prepare_spawn(&options.profile)?;
    let line_editor_pipe_name = env.get("COGNO_LINE_EDITOR_PIPE_NAME").cloned();

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: options.rows,
            cols: options.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&program);
    cmd.args(&args);

    // Set environment variables
    for (key, value) in env {
        cmd.env(key, value);
    }

    // Set working directory (expand ~ if needed)
    let expanded_dir = if working_dir.starts_with("~") {
        if let Some(home) = dirs::home_dir() {
            working_dir.replacen("~", &home.to_string_lossy(), 1)
        } else {
            working_dir
        }
    } else {
        working_dir
    };
    cmd.cwd(expanded_dir);

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;
    let shell_process_id = child.process_id();

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    let should_exit = Arc::new(AtomicBool::new(false));

    let session = Session {
        master: pair.master,
        writer,
        should_exit: should_exit.clone(),
        shell_process_id,
        shell_type: options.profile.shell_type.clone(),
        line_editor_pipe_name,
    };

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(terminal_id.clone(), session);
    }

    // Thread that waits for the child process to end
    let terminal_id_for_child = terminal_id.clone();
    let app_for_child = app.clone();
    let sessions_for_child = state.sessions.clone();

    std::thread::spawn(move || {
        let exit_code = match child.wait() {
            Ok(status) => status.exit_code() as i32,
            Err(_) => 1,
        };

        println!("Child process ended with code: {}", exit_code);

        let _ = app_for_child.emit(
            &format!("pty-exit:{}", terminal_id_for_child),
            serde_json::json!({
                "exitCode": exit_code
            }),
        );

        let mut sessions = sessions_for_child.lock().unwrap();
        sessions.remove(&terminal_id_for_child);
    });

    // Thread that reads PTY output
    let terminal_id_clone = terminal_id.clone();
    let app_clone = app.clone();
    let should_exit_clone = should_exit.clone();

    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        let mut utf8_buffer = Vec::new();

        loop {
            if should_exit_clone.load(Ordering::Relaxed) {
                break;
            }
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => {
                    // EOF - flush any remaining valid UTF-8 data
                    if !utf8_buffer.is_empty() {
                        let data = String::from_utf8_lossy(&utf8_buffer).to_string();
                        let _ = app_clone.emit(&format!("pty-data:{}", terminal_id_clone), data);
                    }
                    break;
                }
                Ok(n) => {
                    if should_exit_clone.load(Ordering::Relaxed) {
                        break;
                    }

                    // Append new data to buffer
                    utf8_buffer.extend_from_slice(&buf[..n]);

                    // Try to convert to UTF-8
                    match String::from_utf8(utf8_buffer.clone()) {
                        Ok(text) => {
                            // All data is valid UTF-8, emit it
                            let _ =
                                app_clone.emit(&format!("pty-data:{}", terminal_id_clone), text);
                            utf8_buffer.clear();
                        }
                        Err(e) => {
                            // Contains invalid UTF-8, but may have valid prefix
                            let valid_up_to = e.utf8_error().valid_up_to();
                            if valid_up_to > 0 {
                                // Emit the valid prefix
                                let text = String::from_utf8_lossy(&utf8_buffer[..valid_up_to])
                                    .to_string();
                                let _ = app_clone
                                    .emit(&format!("pty-data:{}", terminal_id_clone), text);
                                // Keep only the invalid suffix (might be incomplete multi-byte char)
                                utf8_buffer.drain(..valid_up_to);
                            }
                            // If buffer gets too large with invalid data, force flush
                            if utf8_buffer.len() > 16 {
                                let text = String::from_utf8_lossy(&utf8_buffer).to_string();
                                let _ = app_clone
                                    .emit(&format!("pty-data:{}", terminal_id_clone), text);
                                utf8_buffer.clear();
                            }
                        }
                    }
                }
                Err(_e) => {
                    break;
                }
            }
        }
    });

    Ok(PtySpawnResult { shell_process_id })
}

#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();

    if let Some(session) = sessions.get_mut(&terminal_id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;

        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;

        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}

#[tauri::command]
pub fn pty_execute_shell_action(
    state: State<'_, PtyState>,
    terminal_id: String,
    action: String,
    payload_json: Option<String>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();

    let Some(session) = sessions.get(&terminal_id) else {
        return Err(format!("Session not found: {}", terminal_id));
    };

    if session.shell_type != "PowerShell" {
        return Err(format!(
            "Shell actions are not supported for shell type: {}",
            session.shell_type
        ));
    }

    let Some(pipe_name) = session.line_editor_pipe_name.as_deref() else {
        return Err(format!(
            "Shell session {} does not expose a line editor pipe",
            terminal_id
        ));
    };

    write_shell_action_to_pipe(pipe_name, &action, payload_json.as_deref())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();

    if let Some(session) = sessions.get_mut(&terminal_id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}

#[tauri::command]
pub fn pty_kill(
    state: State<'_, PtyState>,
    terminal_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();

    if let Some(session) = sessions.remove(&terminal_id) {
        session.should_exit.store(true, Ordering::Relaxed);
        drop(session.master);
        drop(session.writer);
        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}

#[cfg(windows)]
fn write_shell_action_to_pipe(
    pipe_name: &str,
    action: &str,
    payload_json: Option<&str>,
) -> Result<(), String> {
    let pipe_path = format!(r"\\.\pipe\{}", pipe_name);
    let mut pipe = std::fs::OpenOptions::new()
        .write(true)
        .open(&pipe_path)
        .map_err(|e| format!("Failed to open line editor pipe {}: {}", pipe_path, e))?;

    let message = serde_json::json!({
        "action": action,
        "payload": payload_json
            .and_then(|payload| serde_json::from_str::<serde_json::Value>(payload).ok())
            .unwrap_or(serde_json::Value::Null),
    })
    .to_string();

    pipe.write_all(message.as_bytes())
        .map_err(|e| format!("Failed to write shell action to {}: {}", pipe_path, e))?;
    pipe.write_all(b"\n")
        .map_err(|e| format!("Failed to terminate shell action on {}: {}", pipe_path, e))?;
    pipe.flush()
        .map_err(|e| format!("Failed to flush line editor pipe {}: {}", pipe_path, e))?;

    Ok(())
}

#[cfg(not(windows))]
fn write_shell_action_to_pipe(
    _pipe_name: &str,
    _action: &str,
    _payload_json: Option<&str>,
) -> Result<(), String> {
    Err("Shell actions via pipe are currently only supported on Windows".to_string())
}
