use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
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

/// Bytes sent to the webview but not yet acknowledged by `pty_ack` before the
/// reader thread stops reading (and thereby blocks the shell on stdout, like a
/// real terminal would).
const HIGH_WATERMARK: usize = 1024 * 1024;

/// Reader resumes once unacknowledged bytes drop below this (hysteresis).
const LOW_WATERMARK: usize = 256 * 1024;

/// Upper bound for one wait slice; the loop re-checks `should_exit` so a
/// killed session never leaves the reader parked forever.
const FLOW_CONTROL_WAIT_SLICE: Duration = Duration::from_millis(100);

struct FlowState {
    in_flight: usize,
    /// Once closed (kill/exit), the reader never waits again and acks are
    /// irrelevant. Permanent, so a late `release_all` cannot be undone by
    /// further `add` calls from a still-running reader.
    closed: bool,
}

/// Backpressure between the PTY reader thread and the webview: the reader
/// adds bytes as it sends them, the frontend acknowledges bytes once xterm has
/// parsed them, and the reader waits whenever too much is in flight.
///
/// Lives as long as the reader thread (see `PtyState::flows`), independent of
/// the `Session`, so acks keep working while the reader still runs.
pub(crate) struct FlowControl {
    state: Mutex<FlowState>,
    capacity_available: Condvar,
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
                closed: false,
            }),
            capacity_available: Condvar::new(),
            high_watermark,
            low_watermark,
        }
    }

    fn add(&self, bytes: usize) {
        let mut state = self.state.lock().unwrap();
        if state.closed {
            return;
        }
        state.in_flight = state.in_flight.saturating_add(bytes);
    }

    fn ack(&self, bytes: usize) {
        let mut state = self.state.lock().unwrap();
        state.in_flight = state.in_flight.saturating_sub(bytes);
        self.capacity_available.notify_all();
    }

    /// Wakes every waiter, forgets all in-flight bytes and closes the flow for
    /// good. Used on kill/exit so no ack is ever required to unblock the reader.
    fn release_all(&self) {
        let mut state = self.state.lock().unwrap();
        state.in_flight = 0;
        state.closed = true;
        self.capacity_available.notify_all();
    }

    #[cfg(test)]
    fn in_flight(&self) -> usize {
        self.state.lock().unwrap().in_flight
    }

    /// Blocks while more than `high_watermark` bytes are unacknowledged, until
    /// they drop below `low_watermark`, the flow is closed, or `should_exit`
    /// is set.
    fn wait_for_capacity(&self, should_exit: &AtomicBool) {
        let mut state = self.state.lock().unwrap();
        if state.closed || state.in_flight <= self.high_watermark {
            return;
        }
        while !state.closed
            && state.in_flight >= self.low_watermark
            && !should_exit.load(Ordering::Relaxed)
        {
            let (guard, _) = self
                .capacity_available
                .wait_timeout(state, FLOW_CONTROL_WAIT_SLICE)
                .unwrap();
            state = guard;
        }
    }
}

type FlowRegistry = Arc<Mutex<HashMap<String, Arc<FlowControl>>>>;

/// Removes `flow` from the registry if it is still the registered one for
/// `terminal_id` (a newer session may have reused the id).
fn unregister_flow(flows: &FlowRegistry, terminal_id: &str, flow: &Arc<FlowControl>) {
    let mut flows = flows.lock().unwrap();
    if flows
        .get(terminal_id)
        .is_some_and(|registered| Arc::ptr_eq(registered, flow))
    {
        flows.remove(terminal_id);
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
    should_exit: Arc<AtomicBool>,
    flow: Arc<FlowControl>,
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
    /// Flow controls keyed by terminal id, owned by the reader threads' lifetime
    /// (registered at spawn, unregistered when the reader exits). Kept apart
    /// from `sessions` so `pty_ack` never contends with session-holding work.
    flows: FlowRegistry,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            flows: Arc::new(Mutex::new(HashMap::new())),
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

    let should_exit = Arc::new(AtomicBool::new(false));
    let exit_notified = Arc::new(AtomicBool::new(false));
    let exit_notified_for_child = exit_notified.clone();
    let exit_notified_for_reader = exit_notified.clone();
    let flow = Arc::new(FlowControl::new());
    let flow_for_child = flow.clone();
    let flow_for_reader = flow.clone();
    let should_exit_for_child = should_exit.clone();
    let (input_tx, input_rx) = std::sync::mpsc::channel::<Vec<u8>>();

    let session = Session {
        master: pair.master,
        input_tx,
        should_exit: should_exit.clone(),
        flow: flow.clone(),
        shell_process_id,
        shell_type: options.profile.shell_type.clone(),
        line_editor_pipe_name,
        line_editor_channel,
    };

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(terminal_id.clone(), session);
    }
    {
        let mut flows = state.flows.lock().unwrap();
        flows.insert(terminal_id.clone(), flow);
    }

    // Thread that writes PTY input. Blocking writes happen here, never inside a
    // command holding `sessions`. Ends when the session (and its sender) drops.
    spawn_input_writer_thread(
        writer,
        input_rx,
        terminal_id.clone(),
        app.clone(),
        state.sessions.clone(),
        exit_notified,
    );

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
        // The pane goes away with the exit event; stop the reader too, even if
        // a grandchild still holds the slave side and keeps producing output.
        should_exit_for_child.store(true, Ordering::Relaxed);
        flow_for_child.release_all();

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
    let flows_for_reader = state.flows.clone();

    std::thread::spawn(move || {
        let mut reader = reader;
        // Raw bytes go straight to xterm, whose UTF-8 decoder is stateful across
        // writes; splitting a multi-byte sequence between two reads is fine.
        let mut buf = vec![0u8; READ_BUF_SIZE];

        loop {
            if should_exit_clone.load(Ordering::Relaxed) {
                break;
            }
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if should_exit_clone.load(Ordering::Relaxed) {
                        break;
                    }
                    flow_for_reader.wait_for_capacity(&should_exit_clone);
                    if should_exit_clone.load(Ordering::Relaxed) {
                        break;
                    }
                    flow_for_reader.add(n);
                    if on_data
                        .send(InvokeResponseBody::Raw(buf[..n].to_vec()))
                        .is_err()
                    {
                        // Webview is gone; nothing left to deliver to.
                        break;
                    }
                }
                Err(_) => {
                    break;
                }
            }
        }

        flow_for_reader.release_all();
        unregister_flow(&flows_for_reader, &terminal_id_clone, &flow_for_reader);

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

/// Per-session writer thread: performs the (potentially blocking) PTY writes in
/// arrival order. A broken pipe means the PTY is gone: the session is torn down
/// and the exit event emitted from here.
fn spawn_input_writer_thread(
    mut writer: Box<dyn Write + Send>,
    input_rx: std::sync::mpsc::Receiver<Vec<u8>>,
    terminal_id: String,
    app: AppHandle,
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    exit_notified: Arc<AtomicBool>,
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
            // os error 232 = ERROR_NO_DATA ("The pipe is being closed.") on Windows
            // os error 109 = ERROR_BROKEN_PIPE
            let is_broken_pipe = e
                .raw_os_error()
                .map(|code| code == 109 || code == 232)
                .unwrap_or(false);
            if !is_broken_pipe {
                continue;
            }

            let (emit_exit, _dead_master) = {
                let mut sessions = sessions.lock().unwrap();
                if let Some(session) = sessions.remove(&terminal_id) {
                    session.should_exit.store(true, Ordering::Relaxed);
                    session.flow.release_all();
                    remove_line_editor_channel(&session.line_editor_channel);
                    let emit = exit_notified
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
            break;
        }
    });
}

/// Hands `data` to the session's writer thread. Never blocks on the PTY.
fn queue_pty_input(session: &Session, terminal_id: &str, data: Vec<u8>) -> Result<(), String> {
    session
        .input_tx
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
    queue_pty_input(session, &terminal_id, data.into_bytes())
}

#[tauri::command]
pub fn pty_execute_line_editor_action(
    state: State<'_, PtyState>,
    terminal_id: String,
    action: String,
    payload_json: Option<String>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();

    let Some(session) = sessions.get(&terminal_id) else {
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
        queue_pty_input(session, &terminal_id, pty_input)
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
        session.flow.release_all();
        remove_line_editor_channel(&session.line_editor_channel);
        // Dropping the session drops master and input sender (ends the writer thread).
        drop(session);
        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}

/// Frontend acknowledgement that xterm has parsed `bytes` of PTY output.
/// Only touches the flow registry (never `sessions`), so an ack can always get
/// through, even while another command is busy with a session. Acks for
/// readers that already ended are expected (data was still in the pipeline)
/// and are silently accepted.
#[tauri::command]
pub fn pty_ack(state: State<'_, PtyState>, terminal_id: String, bytes: u32) -> Result<(), String> {
    let flow = {
        let flows = state.flows.lock().unwrap();
        flows.get(&terminal_id).cloned()
    };
    if let Some(flow) = flow {
        flow.ack(bytes as usize);
    }
    Ok(())
}

#[cfg(test)]
mod flow_control_tests {
    use super::*;
    use std::thread;
    use std::time::Instant;

    #[test]
    fn does_not_wait_below_high_watermark() {
        let flow = FlowControl::with_watermarks(100, 50);
        flow.add(100);
        let should_exit = AtomicBool::new(false);
        let start = Instant::now();
        flow.wait_for_capacity(&should_exit);
        assert!(start.elapsed() < FLOW_CONTROL_WAIT_SLICE);
    }

    #[test]
    fn waits_until_acks_drop_below_low_watermark() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        flow.add(150);
        let should_exit = Arc::new(AtomicBool::new(false));

        let waiter = {
            let flow = flow.clone();
            let should_exit = should_exit.clone();
            thread::spawn(move || {
                let start = Instant::now();
                flow.wait_for_capacity(&should_exit);
                start.elapsed()
            })
        };

        thread::sleep(Duration::from_millis(30));
        flow.ack(60); // 90 in flight: still >= low watermark, keep waiting
        thread::sleep(Duration::from_millis(30));
        assert!(!waiter.is_finished());
        flow.ack(50); // 40 in flight: below low watermark, wake up
        let waited = waiter.join().unwrap();
        assert!(waited >= Duration::from_millis(50));
        assert_eq!(flow.in_flight(), 40);
    }

    #[test]
    fn release_all_unblocks_and_resets() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        flow.add(1_000);
        let should_exit = Arc::new(AtomicBool::new(false));
        let waiter = {
            let flow = flow.clone();
            let should_exit = should_exit.clone();
            thread::spawn(move || flow.wait_for_capacity(&should_exit))
        };
        thread::sleep(Duration::from_millis(20));
        flow.release_all();
        waiter.join().unwrap();
        assert_eq!(flow.in_flight(), 0);
    }

    #[test]
    fn should_exit_breaks_the_wait_without_acks() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        flow.add(1_000);
        let should_exit = Arc::new(AtomicBool::new(false));
        let waiter = {
            let flow = flow.clone();
            let should_exit = should_exit.clone();
            thread::spawn(move || flow.wait_for_capacity(&should_exit))
        };
        thread::sleep(Duration::from_millis(20));
        should_exit.store(true, Ordering::Relaxed);
        waiter.join().unwrap();
        assert_eq!(flow.in_flight(), 1_000);
    }

    #[test]
    fn closed_flow_never_waits_again_even_after_more_adds() {
        let flow = FlowControl::with_watermarks(100, 50);
        flow.release_all();
        flow.add(10_000); // reader still running after kill/exit: ignored
        assert_eq!(flow.in_flight(), 0);
        let should_exit = AtomicBool::new(false);
        let start = Instant::now();
        flow.wait_for_capacity(&should_exit);
        assert!(start.elapsed() < FLOW_CONTROL_WAIT_SLICE);
    }

    #[test]
    fn unregister_flow_only_removes_the_matching_arc() {
        let flows: FlowRegistry = Arc::new(Mutex::new(HashMap::new()));
        let old = Arc::new(FlowControl::new());
        let new = Arc::new(FlowControl::new());
        flows.lock().unwrap().insert("t1".to_string(), new.clone());
        unregister_flow(&flows, "t1", &old); // stale reader of a reused id
        assert!(flows.lock().unwrap().contains_key("t1"));
        unregister_flow(&flows, "t1", &new);
        assert!(!flows.lock().unwrap().contains_key("t1"));
    }

    #[test]
    fn ack_never_underflows() {
        let flow = FlowControl::with_watermarks(100, 50);
        flow.add(10);
        flow.ack(1_000);
        assert_eq!(flow.in_flight(), 0);
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
