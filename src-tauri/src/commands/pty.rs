use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
#[cfg(test)]
use std::time::Duration;
use tauri::ipc::{Channel, InvokeResponseBody};
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
    // Only constructed on unix (see create_line_editor_channel).
    #[cfg_attr(not(unix), allow(dead_code))]
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

/// Size of a single PTY read. Under load the pipe hands us whatever is
/// buffered up to this size, so large reads coalesce output into few
/// messages without any extra batching thread.
const READ_BUF_SIZE: usize = 64 * 1024;

/// Bytes handed to the webview but not yet acknowledged before the reader
/// thread stops reading (and thereby blocks the shell on stdout, like a real
/// terminal would).
const HIGH_WATERMARK: usize = 1024 * 1024;

/// Reader resumes once unacknowledged bytes drop below this (hysteresis).
const LOW_WATERMARK: usize = 256 * 1024;

/// Every data message starts with the chunk's sequence number (u32, little
/// endian). The frontend restores order from it and acknowledges by sequence
/// number, so a chunk lost in transit costs that chunk, not the session.
const CHUNK_HEADER_LEN: usize = 4;

fn frame_chunk(seq: u32, data: &[u8]) -> Vec<u8> {
    let mut frame = Vec::with_capacity(CHUNK_HEADER_LEN + data.len());
    frame.extend_from_slice(&seq.to_le_bytes());
    frame.extend_from_slice(data);
    frame
}

struct FlowState {
    in_flight: usize,
    /// Sent but unacknowledged chunks in sequence order.
    sent: VecDeque<(u32, usize)>,
}

/// Backpressure between the PTY reader thread and the webview: the reader
/// registers every chunk it sends, the frontend acknowledges chunks once xterm
/// has parsed them, and the reader waits whenever too much is in flight.
///
/// Also the reader's stop signal: `close()` wakes a waiting reader and makes
/// every later `acquire` fail, so kill/exit never needs an ack to unblock it.
/// The `Arc<FlowControl>` identifies one spawn (terminal ids can be reused).
pub(crate) struct FlowControl {
    state: Mutex<FlowState>,
    capacity_available: Condvar,
    closed: AtomicBool,
    high_watermark: usize,
    low_watermark: usize,
}

impl FlowControl {
    fn new() -> Self {
        Self::with_watermarks(HIGH_WATERMARK, LOW_WATERMARK)
    }

    fn with_watermarks(high_watermark: usize, low_watermark: usize) -> Self {
        Self {
            state: Mutex::new(FlowState {
                in_flight: 0,
                sent: VecDeque::new(),
            }),
            capacity_available: Condvar::new(),
            closed: AtomicBool::new(false),
            high_watermark,
            low_watermark,
        }
    }

    fn is_closed(&self) -> bool {
        self.closed.load(Ordering::Acquire)
    }

    /// Registers chunk `seq` of `bytes` as in flight. Blocks first while more
    /// than the high watermark is unacknowledged, until acks bring it below
    /// the low watermark. Returns false once the flow is closed.
    fn acquire(&self, seq: u32, bytes: usize) -> bool {
        let mut state = self.state.lock().unwrap();
        if state.in_flight > self.high_watermark {
            while !self.is_closed() && state.in_flight >= self.low_watermark {
                state = self.capacity_available.wait(state).unwrap();
            }
        }
        if self.is_closed() {
            return false;
        }
        state.in_flight = state.in_flight.saturating_add(bytes);
        state.sent.push_back((seq, bytes));
        true
    }

    /// Frontend has parsed every chunk up to and including `seq`.
    fn ack_through(&self, seq: u32) {
        let mut state = self.state.lock().unwrap();
        while state.sent.front().is_some_and(|(sent_seq, _)| *sent_seq <= seq) {
            let (_, bytes) = state.sent.pop_front().unwrap();
            state.in_flight = state.in_flight.saturating_sub(bytes);
        }
        self.capacity_available.notify_all();
    }

    /// Stops the reader for good: wakes a waiting reader and makes every later
    /// `acquire` fail. Idempotent.
    fn close(&self) {
        // Set under the lock so a reader that checks `closed` while holding
        // the state lock can never miss the notification.
        let _state = self.state.lock().unwrap();
        self.closed.store(true, Ordering::Release);
        self.capacity_available.notify_all();
    }

    #[cfg(test)]
    fn in_flight(&self) -> usize {
        self.state.lock().unwrap().in_flight
    }
}

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    /// Ordered, non-blocking hand-off to the per-session writer thread. PTY
    /// writes can block (the child stops reading stdin while it is blocked on
    /// stdout during flow control), and a Tauri command must never block while
    /// holding `sessions`. Dropping the session drops the sender, which ends
    /// the writer thread.
    input_tx: std::sync::mpsc::Sender<Vec<u8>>,
    flow: Arc<FlowControl>,
    shell_process_id: Option<u32>,
    shell_type: String,
    line_editor_pipe_name: Option<String>,
    line_editor_channel: Option<LineEditorChannel>,
}

type Sessions = Arc<Mutex<HashMap<String, Session>>>;

/// Removes a session's line-editor channel directory (a private per-session
/// temp dir holding only the FIFO or payload file). Idempotent, so racing
/// removal paths are harmless.
fn remove_line_editor_channel(channel: &Option<LineEditorChannel>) {
    if let Some(channel) = channel {
        if let Some(dir) = channel.path().parent() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}

/// Releases everything a session owns: stops the reader, removes the
/// line-editor channel, drops the master (closes the PTY) and the input sender
/// (ends the writer thread). Must be called without holding `sessions`:
/// closing a ConPTY can block until its output pipe is drained.
fn release_session(session: Session) {
    session.flow.close();
    remove_line_editor_channel(&session.line_editor_channel);
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
    let _ = app.emit(
        &format!("pty-exit:{}", terminal_id),
        serde_json::json!({ "exitCode": exit_code }),
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
    state: State<'_, PtyState>,
    http_server: State<'_, HttpServerState>,
    options: SpawnOptions,
    on_data: Channel<InvokeResponseBody>,
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

    let flow = Arc::new(FlowControl::new());
    let (input_tx, input_rx) = std::sync::mpsc::channel::<Vec<u8>>();

    let session = Session {
        master: pair.master,
        input_tx,
        flow: flow.clone(),
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

            loop {
                if flow.is_closed() {
                    break;
                }
                let n = match std::io::Read::read(&mut reader, &mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => n,
                };
                if !flow.acquire(seq, n) {
                    break;
                }
                if on_data
                    .send(InvokeResponseBody::Raw(frame_chunk(seq, &buf[..n])))
                    .is_err()
                {
                    // Webview is gone; nothing left to deliver to.
                    break;
                }
                seq = seq.wrapping_add(1);
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

#[tauri::command]
pub fn pty_kill(
    state: State<'_, PtyState>,
    terminal_id: String,
) -> Result<(), String> {
    let removed = {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.remove(&terminal_id)
    };
    match removed {
        // Intentional kill: the frontend already dropped the pane, no exit event.
        Some(session) => {
            release_session(session);
            Ok(())
        }
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
        sessions.get(&terminal_id).map(|session| session.flow.clone())
    };
    if let Some(flow) = flow {
        flow.ack_through(seq);
    }
    Ok(())
}

#[cfg(test)]
mod flow_control_tests {
    use super::*;
    use std::thread;
    use std::time::Instant;

    fn short() -> Duration {
        Duration::from_millis(50)
    }

    #[test]
    fn acquire_does_not_wait_below_high_watermark() {
        let flow = FlowControl::with_watermarks(100, 50);
        assert!(flow.acquire(0, 100));
        let start = Instant::now();
        assert!(flow.acquire(1, 1));
        assert!(start.elapsed() < short());
        assert_eq!(flow.in_flight(), 101);
    }

    #[test]
    fn acquire_waits_until_acks_drop_below_low_watermark() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        assert!(flow.acquire(0, 60));
        assert!(flow.acquire(1, 90)); // 150 in flight: the next acquire waits

        let waiter = {
            let flow = flow.clone();
            thread::spawn(move || {
                let start = Instant::now();
                let acquired = flow.acquire(2, 10);
                (acquired, start.elapsed())
            })
        };

        thread::sleep(Duration::from_millis(30));
        flow.ack_through(0); // 90 in flight: still >= low watermark, keep waiting
        thread::sleep(Duration::from_millis(30));
        assert!(!waiter.is_finished());
        flow.ack_through(1); // 0 in flight: below low watermark, wake up
        let (acquired, waited) = waiter.join().unwrap();
        assert!(acquired);
        assert!(waited >= Duration::from_millis(50));
        assert_eq!(flow.in_flight(), 10);
    }

    #[test]
    fn ack_through_releases_every_chunk_up_to_seq_including_lost_ones() {
        let flow = FlowControl::with_watermarks(1_000, 500);
        assert!(flow.acquire(0, 10));
        assert!(flow.acquire(1, 20)); // never parsed by the frontend (lost in transit)
        assert!(flow.acquire(2, 30));
        assert!(flow.acquire(3, 40));
        flow.ack_through(2);
        assert_eq!(flow.in_flight(), 40);
        flow.ack_through(2); // duplicate ack: no effect
        assert_eq!(flow.in_flight(), 40);
        flow.ack_through(1_000); // ack beyond what was sent
        assert_eq!(flow.in_flight(), 0);
    }

    #[test]
    fn close_unblocks_a_waiting_reader_and_fails_the_acquire() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        assert!(flow.acquire(0, 1_000));
        let waiter = {
            let flow = flow.clone();
            thread::spawn(move || flow.acquire(1, 1))
        };
        thread::sleep(Duration::from_millis(20));
        assert!(!waiter.is_finished());
        flow.close();
        assert!(!waiter.join().unwrap());
        assert!(flow.is_closed());
    }

    #[test]
    fn closed_flow_never_acquires_again() {
        let flow = FlowControl::with_watermarks(100, 50);
        flow.close();
        let start = Instant::now();
        assert!(!flow.acquire(0, 10));
        assert!(!flow.acquire(1, 10_000));
        assert!(start.elapsed() < short());
        assert_eq!(flow.in_flight(), 0);
        flow.close(); // idempotent
    }

    #[test]
    fn frame_chunk_prefixes_the_sequence_number_little_endian() {
        let frame = frame_chunk(0x0102_0304, b"ab");
        assert_eq!(frame, vec![0x04, 0x03, 0x02, 0x01, b'a', b'b']);
        assert_eq!(frame.len(), CHUNK_HEADER_LEN + 2);
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
