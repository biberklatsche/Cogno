#[cfg(windows)]
use portable_pty::ChildKiller;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Manager, State};

use super::flow_control::{frame_chunk, FlowControl, MAX_CHUNK_SIZE};
use super::line_editor::{
    build_line_editor_message, create_line_editor_channel, is_line_editor_action_name,
    remove_line_editor_channel, write_message_to_fifo, write_message_to_trigger_file,
    write_shell_action_to_pipe, LineEditorChannel, LINE_EDITOR_TRIGGER,
};
use super::window_registry::{route, WindowRegistry};

use super::shell_spawner::{ShellProfile, ShellSpawner};
use crate::http_server::HttpServerState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub name: String,
    pub cols: u16,
    pub rows: u16,
    pub profile: ShellProfile,
    pub dev_mode: Option<bool>,
}

/// Size of a single PTY read. Under load the pipe hands us whatever is
/// buffered up to this size, so large reads coalesce output into few
/// messages without any extra batching thread.
const READ_BUF_SIZE: usize = 64 * 1024;

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    /// Ordered, non-blocking hand-off to the per-session writer thread. PTY
    /// writes can block (the child stops reading stdin while it is blocked on
    /// stdout during flow control), and a Tauri command must never block while
    /// holding `sessions`. Dropping the session drops the sender, which ends
    /// the writer thread.
    input_tx: std::sync::mpsc::Sender<Vec<u8>>,
    flow: Arc<FlowControl>,
    /// Ends the shell when the session is released. On Unix closing the
    /// master already hangs up the shell (and lets it write its history on
    /// the way out); ConPTY does not terminate its clients when the console
    /// closes, so on Windows this is the only thing that does.
    #[cfg(windows)]
    child_killer: Box<dyn ChildKiller + Send + Sync>,
    shell_process_id: Option<u32>,
    shell_type: String,
    line_editor_pipe_name: Option<String>,
    line_editor_channel: Option<LineEditorChannel>,
}

type Sessions = Arc<Mutex<HashMap<String, Session>>>;

/// Releases everything a session owns: stops the reader, removes the
/// line-editor channel, drops the master (closes the PTY) and the input sender
/// (ends the writer thread). Must be called without holding `sessions`:
/// closing a ConPTY can block until its output pipe is drained.
fn release_session(session: Session) {
    // Only the Windows kill below needs `&mut`.
    #[cfg(windows)]
    let mut session = session;
    session.flow.close();
    remove_line_editor_channel(&session.line_editor_channel);
    #[cfg(windows)]
    if let Err(e) = session.child_killer.kill() {
        // Already gone (the wait thread ends the entry in that case) or not
        // ours to kill any more; nothing to do about either.
        log::debug!(target: "pty", "kill of shell failed: {}", e);
    }
    drop(session);
}

/// Ends the spawn identified by `flow`, from whichever thread notices first:
/// removes its map entry (only if the id still belongs to this spawn), releases
/// it, and emits `pty-exit` for it. A spawn whose entry is already gone was
/// killed or replaced on purpose, so it emits nothing. Idempotent.
fn end_session(
    sessions: &Sessions,
    terminal_id: &str,
    flow: &Arc<FlowControl>,
    app: &AppHandle,
    exit_code: i32,
) {
    let removed = {
        let mut sessions = sessions.lock().unwrap();
        match sessions.get(terminal_id) {
            Some(session) if Arc::ptr_eq(&session.flow, flow) => sessions.remove(terminal_id),
            _ => None,
        }
    };
    flow.close();
    let Some(session) = removed else {
        return;
    };
    release_session(session);
    route(
        app,
        &format!("pty-exit:{}", terminal_id),
        serde_json::json!({ "exitCode": exit_code }),
        Some(terminal_id),
    );
}

pub struct PtyState {
    sessions: Sessions,
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
    window: tauri::WebviewWindow,
    state: State<'_, PtyState>,
    http_server: State<'_, HttpServerState>,
    options: SpawnOptions,
    on_data: Channel<InvokeResponseBody>,
) -> Result<PtySpawnResult, String> {
    let terminal_id = options.name.clone();
    // Bind the session to the window that spawned it, so its events route back
    // to that window instead of broadcasting to all of them.
    app.state::<WindowRegistry>()
        .bind_terminal(&terminal_id, window.label());

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
        cmd.env("COGNO_TOKEN", http_server.token());
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

    let flow = Arc::new(FlowControl::new());
    let (input_tx, input_rx) = std::sync::mpsc::channel::<Vec<u8>>();

    let session = Session {
        master: pair.master,
        input_tx,
        flow: flow.clone(),
        #[cfg(windows)]
        child_killer: child.clone_killer(),
        shell_process_id,
        shell_type: options.profile.shell_type.clone(),
        line_editor_pipe_name,
        line_editor_channel,
    };

    let replaced = {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(terminal_id.clone(), session)
    };
    if let Some(old_session) = replaced {
        // The id is reused (e.g. webview reload re-spawning a persisted
        // layout). The old spawn's threads only ever touch their own entry, so
        // ending it here cannot disturb the new session.
        log::warn!(
            target: "pty",
            "terminal_id={} respawned while a session was still alive; replacing it",
            terminal_id
        );
        release_session(old_session);
    }

    // Thread that writes PTY input. Blocking writes happen here, never inside a
    // command holding `sessions`. Ends when the session (and its sender) drops.
    spawn_input_writer_thread(
        writer,
        input_rx,
        terminal_id.clone(),
        app.clone(),
        state.sessions.clone(),
        flow.clone(),
    );

    // Thread that waits for the child process to end
    {
        let terminal_id = terminal_id.clone();
        let app = app.clone();
        let sessions = state.sessions.clone();
        let flow = flow.clone();
        std::thread::spawn(move || {
            let exit_code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(_) => 1,
            };
            log::info!(
                target: "pty",
                "child process exited terminal_id={} shell_pid={:?} exit_code={}",
                terminal_id,
                shell_process_id,
                exit_code
            );
            // The pane goes away with the exit event; this also stops the
            // reader, even if a grandchild still holds the slave side and
            // keeps producing output.
            end_session(&sessions, &terminal_id, &flow, &app, exit_code);
        });
    }

    // Thread that reads PTY output
    {
        let terminal_id = terminal_id.clone();
        let app = app.clone();
        let sessions = state.sessions.clone();
        std::thread::spawn(move || {
            let mut reader = reader;
            // Raw bytes go straight to xterm, whose UTF-8 decoder is stateful
            // across writes; splitting a multi-byte sequence between two reads
            // is fine.
            let mut buf = vec![0u8; READ_BUF_SIZE];
            let mut seq: u32 = 0;

            'reader: loop {
                if flow.is_closed() {
                    break;
                }
                let n = match std::io::Read::read(&mut reader, &mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => n,
                };
                // Split into pieces under MAX_CHUNK_SIZE: a read can be up to
                // READ_BUF_SIZE, far past the size that keeps every message on
                // the webview channel's reliable delivery path (see
                // MAX_CHUNK_SIZE). xterm's parser is stateful across writes,
                // so splitting mid-sequence is fine, same as splitting across
                // reads already was.
                for sub_chunk in buf[..n].chunks(MAX_CHUNK_SIZE) {
                    if !flow.acquire(seq, sub_chunk.len()) {
                        break 'reader;
                    }
                    if on_data
                        .send(InvokeResponseBody::Raw(frame_chunk(seq, sub_chunk)))
                        .is_err()
                    {
                        // Webview is gone; nothing left to deliver to.
                        break 'reader;
                    }
                    seq = seq.wrapping_add(1);
                }
            }

            // EOF, read error or a lost webview: the PTY is unusable. If the
            // session was killed or replaced instead, the entry is already
            // gone and this is a no-op.
            end_session(&sessions, &terminal_id, &flow, &app, -1);
        });
    }

    Ok(PtySpawnResult { shell_process_id })
}

/// Per-session writer thread: performs the (potentially blocking) PTY writes in
/// arrival order. Any write error means the PTY is unusable (broken pipe once
/// conhost/the slave is gone, EIO on Unix, ...): the session ends and the exit
/// event is emitted from here, so failed input never disappears silently.
fn spawn_input_writer_thread(
    mut writer: Box<dyn Write + Send>,
    input_rx: std::sync::mpsc::Receiver<Vec<u8>>,
    terminal_id: String,
    app: AppHandle,
    sessions: Sessions,
    flow: Arc<FlowControl>,
) {
    std::thread::spawn(move || {
        while let Ok(data) = input_rx.recv() {
            let write_result = writer.write_all(&data).and_then(|_| writer.flush());
            let Err(e) = write_result else {
                continue;
            };
            log::warn!(
                target: "pty",
                "write to PTY failed terminal_id={} error={}",
                terminal_id,
                e
            );
            end_session(&sessions, &terminal_id, &flow, &app, -1);
            break;
        }
    });
}

/// Hands `data` to the session's writer thread. Never blocks on the PTY.
fn queue_pty_input(
    input_tx: &std::sync::mpsc::Sender<Vec<u8>>,
    terminal_id: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    input_tx
        .send(data)
        .map_err(|_| format!("Session is closing: {}", terminal_id))
}

#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let Some(session) = sessions.get(&terminal_id) else {
        return Err(format!("Session not found: {}", terminal_id));
    };
    queue_pty_input(&session.input_tx, &terminal_id, data.into_bytes())
}

#[tauri::command]
pub fn pty_execute_line_editor_action(
    state: State<'_, PtyState>,
    terminal_id: String,
    action: String,
    payload_json: Option<String>,
) -> Result<(), String> {
    if !is_line_editor_action_name(&action) {
        return Err(format!("Invalid line editor action: {:?}", action));
    }
    // Copy what the pipe/FIFO/file writes below need and release the lock
    // first: they can block, and nothing may block while holding `sessions`.
    let (shell_type, line_editor_pipe_name, line_editor_channel, input_tx) = {
        let sessions = state.sessions.lock().unwrap();
        let Some(session) = sessions.get(&terminal_id) else {
            return Err(format!("Session not found: {}", terminal_id));
        };
        (
            session.shell_type.clone(),
            session.line_editor_pipe_name.clone(),
            session.line_editor_channel.clone(),
            session.input_tx.clone(),
        )
    };

    if shell_type == "PowerShell" {
        let Some(pipe_name) = line_editor_pipe_name.as_deref() else {
            return Err(format!(
                "Shell session {} does not expose a line editor pipe",
                terminal_id
            ));
        };
        return write_shell_action_to_pipe(pipe_name, &action, payload_json.as_deref());
    }

    let Some(channel) = line_editor_channel else {
        return Err(format!(
            "Shell actions are not supported for shell type: {}",
            shell_type
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
        queue_pty_input(&input_tx, &terminal_id, pty_input)
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

/// Releasing a session can block (closing a ConPTY waits for its output pipe),
/// so it runs on a blocking worker, never on the thread that drives the UI.
#[tauri::command]
pub async fn pty_kill(state: State<'_, PtyState>, terminal_id: String) -> Result<(), String> {
    let removed = {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.remove(&terminal_id)
    };
    match removed {
        // Intentional kill: the frontend already dropped the pane, no exit event.
        Some(session) => tauri::async_runtime::spawn_blocking(move || release_session(session))
            .await
            .map_err(|error| error.to_string()),
        None => Err(format!("Session not found: {}", terminal_id)),
    }
}

/// Frontend acknowledgement that xterm has parsed every chunk up to and
/// including `seq`. Acks for sessions that already ended are expected (data
/// was still in the pipeline) and silently accepted.
#[tauri::command]
pub fn pty_ack(state: State<'_, PtyState>, terminal_id: String, seq: u32) -> Result<(), String> {
    let flow = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&terminal_id)
            .map(|session| session.flow.clone())
    };
    if let Some(flow) = flow {
        flow.ack_through(seq);
    }
    Ok(())
}
