use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

use crate::http_server::HttpServerState;
use super::shell_spawner::{ShellProfile, ShellSpawner};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub name: String,
    pub cols: u16,
    pub rows: u16,
    pub profile: ShellProfile,
    pub dev_mode: Option<bool>,
}

/// Per-session transport for native line-editor actions of POSIX shells.
/// zsh reads a FIFO through a `zle -F` fd-watcher; bash has no fd hook, so it
/// gets a payload file plus a trigger byte sequence injected into the PTY
/// that fires a `bind -x` handler reading that file.
#[derive(Clone)]
enum LineEditorChannel {
    Fifo(std::path::PathBuf),
    TriggerFile(std::path::PathBuf),
}

impl LineEditorChannel {
    fn path(&self) -> &std::path::Path {
        match self {
            LineEditorChannel::Fifo(path) => path,
            LineEditorChannel::TriggerFile(path) => path,
        }
    }
}

/// Byte sequence bound to the bash line-editor handler (`bind -x`). A
/// private CSI-style sequence no terminal emits and no user can type.
const LINE_EDITOR_TRIGGER: &[u8] = b"\x1b[5005~";

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    should_exit: Arc<AtomicBool>,
    exit_notified: Arc<AtomicBool>,
    shell_process_id: Option<u32>,
    shell_type: String,
    line_editor_pipe_name: Option<String>,
    line_editor_channel: Option<LineEditorChannel>,
}

/// Removes a session's line-editor channel directory (a private per-session
/// temp dir holding only the FIFO or payload file). Called from every place
/// a session is dropped; idempotent, so racing removal paths are harmless.
fn remove_line_editor_channel(channel: &Option<LineEditorChannel>) {
    if let Some(channel) = channel {
        if let Some(dir) = channel.path().parent() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }
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
    http_server: State<'_, HttpServerState>,
    options: SpawnOptions,
) -> Result<PtySpawnResult, String> {
    let terminal_id = options.name.clone();

    // Prepare shell spawn with integration
    let dev_mode = options.dev_mode.unwrap_or(false);
    let spawner = ShellSpawner::new(dev_mode)?;
    let (program, args, env, working_dir) = spawner.prepare_spawn(&options.profile)?;
    let line_editor_pipe_name = env.get("COGNO_LINE_EDITOR_PIPE_NAME").cloned();
    let line_editor_channel = create_line_editor_channel(&options.profile.shell_type, &env);

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

    match &line_editor_channel {
        Some(LineEditorChannel::Fifo(path)) => {
            cmd.env("COGNO_LINE_EDITOR_PIPE", path.as_os_str());
        }
        Some(LineEditorChannel::TriggerFile(path)) => {
            cmd.env("COGNO_LINE_EDITOR_FILE", path.as_os_str());
        }
        None => {}
    }

    // Inject HTTP server port and terminal ID so hooks can reach cogno
    let http_port = http_server.port();
    if http_port != 0 {
        cmd.env("COGNO_PORT", http_port.to_string());
    }
    cmd.env("COGNO_TERMINAL_ID", &terminal_id);

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
    let exit_notified = Arc::new(AtomicBool::new(false));
    let exit_notified_for_child = exit_notified.clone();
    let exit_notified_for_reader = exit_notified.clone();

    let session = Session {
        master: pair.master,
        writer,
        should_exit: should_exit.clone(),
        exit_notified,
        shell_process_id,
        shell_type: options.profile.shell_type.clone(),
        line_editor_pipe_name,
        line_editor_channel,
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

        log::info!(
            target: "pty",
            "child process exited terminal_id={} shell_pid={:?} exit_code={}",
            terminal_id_for_child,
            shell_process_id,
            exit_code
        );

        let mut sessions = sessions_for_child.lock().unwrap();
        if let Some(session) = sessions.remove(&terminal_id_for_child) {
            remove_line_editor_channel(&session.line_editor_channel);
        }
        drop(sessions);

        if exit_notified_for_child
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
            .is_ok()
        {
            let _ = app_for_child.emit(
                &format!("pty-exit:{}", terminal_id_for_child),
                serde_json::json!({
                    "exitCode": exit_code
                }),
            );
        }
    });

    // Thread that reads PTY output
    let terminal_id_clone = terminal_id.clone();
    let app_clone = app.clone();
    let should_exit_clone = should_exit.clone();
    let sessions_for_reader = state.sessions.clone();

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
                Err(_) => {
                    break;
                }
            }
        }

        // PTY died unexpectedly (EOF or read error, not an intentional kill).
        // Emit exit immediately so the tab closes without waiting for child.wait().
        if !should_exit_clone.load(Ordering::Relaxed)
            && exit_notified_for_reader
                .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
                .is_ok()
        {
            let mut sessions = sessions_for_reader.lock().unwrap();
            if let Some(session) = sessions.remove(&terminal_id_clone) {
                remove_line_editor_channel(&session.line_editor_channel);
            }
            drop(sessions);

            let _ = app_clone.emit(
                &format!("pty-exit:{}", terminal_id_clone),
                serde_json::json!({ "exitCode": -1 }),
            );
        }
    });

    Ok(PtySpawnResult { shell_process_id })
}

#[tauri::command]
pub fn pty_write(
    app: AppHandle,
    state: State<'_, PtyState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let write_result = {
        let mut sessions = state.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(&terminal_id) {
            session
                .writer
                .write_all(data.as_bytes())
                .and_then(|_| session.writer.flush())
        } else {
            return Err(format!("Session not found: {}", terminal_id));
        }
    };

    if let Err(ref e) = write_result {
        // os error 232 = ERROR_NO_DATA ("The pipe is being closed.") on Windows
        // os error 109 = ERROR_BROKEN_PIPE
        let is_broken_pipe = e
            .raw_os_error()
            .map(|code| code == 109 || code == 232)
            .unwrap_or(false);

        if is_broken_pipe {
            let (emit_exit, _dead_master) = {
                let mut sessions = state.sessions.lock().unwrap();
                if let Some(session) = sessions.remove(&terminal_id) {
                    session.should_exit.store(true, Ordering::Relaxed);
                    remove_line_editor_channel(&session.line_editor_channel);
                    let emit = session
                        .exit_notified
                        .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
                        .is_ok();
                    (emit, Some(session.master))
                } else {
                    (false, None)
                }
            }; // lock released; _dead_master drops here, after the lock
            if emit_exit {
                let _ = app.emit(
                    &format!("pty-exit:{}", terminal_id),
                    serde_json::json!({ "exitCode": -1 }),
                );
            }
        }
    }

    write_result.map_err(|e| format!("Failed to write to PTY: {}", e))
}

#[tauri::command]
pub fn pty_execute_line_editor_action(
    state: State<'_, PtyState>,
    terminal_id: String,
    action: String,
    payload_json: Option<String>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();

    let Some(session) = sessions.get_mut(&terminal_id) else {
        return Err(format!("Session not found: {}", terminal_id));
    };

    if session.shell_type == "PowerShell" {
        let Some(pipe_name) = session.line_editor_pipe_name.as_deref() else {
            return Err(format!(
                "Shell session {} does not expose a line editor pipe",
                terminal_id
            ));
        };
        return write_shell_action_to_pipe(pipe_name, &action, payload_json.as_deref());
    }

    let Some(channel) = session.line_editor_channel.clone() else {
        return Err(format!(
            "Shell actions are not supported for shell type: {}",
            session.shell_type
        ));
    };

    let (message, auto_execute) = build_line_editor_message(&action, payload_json.as_deref());

    let mut pty_input: Vec<u8> = Vec::new();
    match &channel {
        LineEditorChannel::Fifo(path) => {
            write_message_to_fifo(path, &message)?;
        }
        LineEditorChannel::TriggerFile(path) => {
            write_message_to_trigger_file(path, &message)?;
            // The payload is on disk; the trigger sequence makes the shell's
            // `bind -x` handler pick it up.
            pty_input.extend_from_slice(LINE_EDITOR_TRIGGER);
        }
    }

    // The shell-side handlers cannot submit (accept-line is a no-op inside a
    // `zle -F` widget, and readline has no accept from `bind -x`), so
    // autoExecute is implemented here: a CR through the PTY, written after
    // the request. ZLE services fd handlers before pending keyboard bytes
    // (and readline processes the trigger sequence strictly before the CR),
    // so the CR always accepts the freshly replaced buffer, never the old
    // one.
    if auto_execute {
        pty_input.push(b'\r');
    }
    if !pty_input.is_empty() {
        session
            .writer
            .write_all(&pty_input)
            .and_then(|_| session.writer.flush())
            .map_err(|e| format!("Failed to write line editor trigger: {}", e))?;
    }

    Ok(())
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
        remove_line_editor_channel(&session.line_editor_channel);
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

/// Creates the per-session transport backing the native line-editor channel
/// of POSIX shells: a FIFO for zsh (read via `zle -F`), a payload file for
/// bash (read by the `bind -x` trigger handler). Returns None when the shell
/// has no such channel or creation fails - the integration script then finds
/// no COGNO_LINE_EDITOR_PIPE/COGNO_LINE_EDITOR_FILE, reports no native
/// actions in the capability handshake, and the app stays on the raw
/// fallback.
fn create_line_editor_channel(
    shell_type: &str,
    env: &HashMap<String, String>,
) -> Option<LineEditorChannel> {
    // Without integration no script would ever read the channel.
    if !env.contains_key("COGNO_INTEGRATION_ROOT") {
        return None;
    }
    let session_id = env.get("COGNO_SESSION_ID")?;

    let wants_fifo = shell_type == "ZSH";
    let wants_trigger_file = shell_type == "Bash" || shell_type == "GitBash";
    if !wants_fifo && !wants_trigger_file {
        return None;
    }
    if wants_fifo && cfg!(not(unix)) {
        return None;
    }

    // Command lines can contain secrets: private per-session directory.
    let dir = std::env::temp_dir().join(format!("cogno-{}", session_id));
    if let Err(e) = std::fs::create_dir_all(&dir) {
        log::warn!(target: "pty", "failed to create line editor dir: {}", e);
        return None;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)) {
            log::warn!(target: "pty", "failed to restrict line editor dir: {}", e);
            return None;
        }
    }

    let path = dir.join("line-editor");
    if wants_trigger_file {
        // The payload file itself is (re)written atomically per request.
        return Some(LineEditorChannel::TriggerFile(path));
    }

    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
        if unsafe { libc::mkfifo(c_path.as_ptr(), 0o600) } != 0 {
            log::warn!(
                target: "pty",
                "failed to create line editor fifo: {}",
                std::io::Error::last_os_error()
            );
            let _ = std::fs::remove_dir(&dir);
            return None;
        }
        Some(LineEditorChannel::Fifo(path))
    }
    #[cfg(not(unix))]
    None
}

/// Builds the line-format message the shell handlers consume with
/// `IFS=';' read -r action cursor autoexec text`: the text is the last
/// field, so it may contain unescaped semicolons; only backslash, CR and LF
/// are escaped (decoded shell-side via ${(g::)...} in zsh, printf %b in
/// bash). Returns the message and whether the request asks for autoExecute.
fn build_line_editor_message(action: &str, payload_json: Option<&str>) -> (String, bool) {
    let payload = payload_json
        .and_then(|payload| serde_json::from_str::<serde_json::Value>(payload).ok())
        .unwrap_or(serde_json::Value::Null);
    let text = payload
        .get("text")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let cursor_index = payload
        .get("cursorIndex")
        .and_then(|value| value.as_i64())
        .unwrap_or(-1);
    let auto_execute = payload
        .get("autoExecute")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    let escaped_text = text
        .replace('\\', "\\\\")
        .replace('\r', "\\r")
        .replace('\n', "\\n");
    let message = format!(
        "{};{};{};{}\n",
        action,
        cursor_index,
        if auto_execute { "1" } else { "0" },
        escaped_text
    );
    (message, auto_execute)
}

#[cfg(unix)]
fn write_message_to_fifo(fifo_path: &std::path::Path, message: &str) -> Result<(), String> {
    use std::os::unix::fs::OpenOptionsExt;

    // O_NONBLOCK makes the open fail with ENXIO instead of blocking forever
    // when the shell never opened its read end (integration failed to load).
    // The shell keeps the FIFO open read-write for the whole session, so a
    // healthy session always has a reader.
    let mut fifo = std::fs::OpenOptions::new()
        .write(true)
        .custom_flags(libc::O_NONBLOCK)
        .open(fifo_path)
        .map_err(|e| {
            format!(
                "Failed to open line editor fifo {}: {}",
                fifo_path.display(),
                e
            )
        })?;

    fifo.write_all(message.as_bytes()).map_err(|e| {
        format!(
            "Failed to write shell action to {}: {}",
            fifo_path.display(),
            e
        )
    })
}

#[cfg(not(unix))]
fn write_message_to_fifo(_fifo_path: &std::path::Path, _message: &str) -> Result<(), String> {
    Err("Shell actions via fifo are only supported on Unix".to_string())
}

/// Replaces the payload file atomically (write to a sibling temp file, then
/// rename), so the `bind -x` handler triggered right afterwards can never
/// observe a partial write.
fn write_message_to_trigger_file(path: &std::path::Path, message: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, message.as_bytes())
        .map_err(|e| format!("Failed to write line editor file {}: {}", path.display(), e))?;
    std::fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed to publish line editor file {}: {}", path.display(), e))
}
