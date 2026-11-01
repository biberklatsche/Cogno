use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
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

#[cfg(windows)]
use super::shell_job::ShellJob;
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
    /// Ends the shell when the session is released: SIGHUP on Unix (what a
    /// closing terminal sends; the shell saves its history and hangs up its
    /// jobs), `TerminateProcess` on Windows (ConPTY does not end its clients
    /// when the console closes). Closing the master alone would not do it:
    /// the reader thread holds its own descriptor while blocked in `read`.
    child_killer: Box<dyn ChildKiller + Send + Sync>,
    /// Held only for its drop: ends the shell's whole process tree with the
    /// session, and with the process should Cogno abort (see `shell_job`).
    #[cfg(windows)]
    _job: Option<ShellJob>,
    shell_process_id: Option<u32>,
    shell_type: String,
    line_editor_pipe_name: Option<String>,
    line_editor_channel: Option<LineEditorChannel>,
}

type Sessions = Arc<Mutex<HashMap<String, Session>>>;

/// Releases everything a session owns: stops the reader, removes the
/// line-editor channel, ends the shell, drops the master (closes the PTY) and
/// the input sender (ends the writer thread). Must be called without holding
/// `sessions`: closing a ConPTY can block until its output pipe is drained.
fn release_session(mut session: Session) {
    session.flow.close();
    remove_line_editor_channel(&session.line_editor_channel);
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

    /// Ends every shell: what the app does on its way out, so no shell (or,
    /// on Windows, grandchild) is left running after the window is gone.
    pub fn release_all(&self) {
        let sessions: Vec<Session> = {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.drain().map(|(_, session)| session).collect()
        };
        for session in sessions {
            release_session(session);
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
    // A shell that fails to join a job (a restricted job around Cogno itself)
    // still runs; it just ends the old way, by TerminateProcess alone.
    #[cfg(windows)]
    let job = shell_process_id.and_then(|pid| match ShellJob::containing(pid) {
        Ok(job) => Some(job),
        Err(error) => {
            log::warn!(
                target: "pty",
                "shell_pid={} could not join a job object: {}",
                pid,
                error
            );
            None
        }
    });

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = master_writer(&*pair.master)?;

    let flow = Arc::new(FlowControl::new());
    let (input_tx, input_rx) = std::sync::mpsc::channel::<Vec<u8>>();

    let session = Session {
        master: pair.master,
        input_tx,
        flow: flow.clone(),
        child_killer: child.clone_killer(),
        #[cfg(windows)]
        _job: job,
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
            pump_pty_output(reader, &flow, |frame| {
                on_data.send(InvokeResponseBody::Raw(frame)).is_ok()
            });

            // EOF, read error or a lost webview: the PTY is unusable. If the
            // session was killed or replaced instead, the entry is already
            // gone and this is a no-op.
            end_session(&sessions, &terminal_id, &flow, &app, -1);
        });
    }

    Ok(PtySpawnResult { shell_process_id })
}

/// Reads PTY output and hands it to `deliver` as framed chunks under flow
/// control, until the PTY ends or `deliver` returns false (the webview is
/// gone). Once the flow is closed (kill, exit, respawn) nothing is delivered
/// any more, but reading goes on until the PTY ends: a reader that stops
/// while the pipe is full leaves the shell blocked on its write, and before
/// Windows 11 24H2 `ClosePseudoConsole` then waits for that pipe forever.
fn pump_pty_output(
    mut reader: Box<dyn std::io::Read + Send>,
    flow: &FlowControl,
    mut deliver: impl FnMut(Vec<u8>) -> bool,
) {
    // Raw bytes go straight to xterm, whose UTF-8 decoder is stateful
    // across writes; splitting a multi-byte sequence between two reads
    // is fine.
    let mut buf = vec![0u8; READ_BUF_SIZE];
    let mut seq: u32 = 0;

    'reader: loop {
        let n = match reader.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => n,
        };
        if flow.is_closed() {
            continue;
        }
        // Split into pieces under MAX_CHUNK_SIZE: a read can be up to
        // READ_BUF_SIZE, far past the size that keeps every message on
        // the webview channel's reliable delivery path (see
        // MAX_CHUNK_SIZE). xterm's parser is stateful across writes,
        // so splitting mid-sequence is fine, same as splitting across
        // reads already was.
        for sub_chunk in buf[..n].chunks(MAX_CHUNK_SIZE) {
            if !flow.acquire(seq, sub_chunk.len()) {
                // Closed while waiting for capacity: drain from here on.
                continue 'reader;
            }
            if !deliver(frame_chunk(seq, sub_chunk)) {
                break 'reader;
            }
            seq = seq.wrapping_add(1);
        }
    }
}

/// The handle PTY input is written through. On Unix this is a plain duplicate
/// of the master descriptor: portable-pty's own writer sends a newline and EOF
/// to the shell when it is dropped, which would run whatever line the user had
/// typed but not yet entered when the pane closes.
#[cfg(unix)]
fn master_writer(master: &dyn MasterPty) -> Result<Box<dyn Write + Send>, String> {
    use std::os::unix::io::FromRawFd;

    let fd = master
        .as_raw_fd()
        .ok_or_else(|| "PTY master has no file descriptor".to_string())?;
    // SAFETY: `fd` is the open master descriptor owned by `master`; `dup`
    // returns a new descriptor that the returned `File` then owns.
    let duplicate = unsafe { libc::dup(fd) };
    if duplicate < 0 {
        return Err(format!(
            "Failed to duplicate PTY master: {}",
            std::io::Error::last_os_error()
        ));
    }
    unsafe { libc::fcntl(duplicate, libc::F_SETFD, libc::FD_CLOEXEC) };
    Ok(Box::new(unsafe { std::fs::File::from_raw_fd(duplicate) }))
}

#[cfg(windows)]
fn master_writer(master: &dyn MasterPty) -> Result<Box<dyn Write + Send>, String> {
    master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))
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

#[cfg(all(test, unix))]
mod unix_tests {
    use super::*;
    use std::io::Read;
    use std::time::{Duration, Instant};

    /// Waits up to `limit` for `condition`; the shell lives in another process.
    fn wait_until(limit: Duration, mut condition: impl FnMut() -> bool) -> bool {
        let started = Instant::now();
        while started.elapsed() < limit {
            if condition() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        condition()
    }

    #[test]
    fn releasing_a_session_hangs_up_the_shell_without_entering_the_pending_line() {
        let marker = std::env::temp_dir().join(format!(
            "cogno-pty-release-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_file(&marker);

        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("sh");
        cmd.arg("-i");
        cmd.env("PS1", "$ ");
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);

        // Drain output like the reader thread does, so the shell never blocks.
        let output = Arc::new(Mutex::new(Vec::<u8>::new()));
        let mut reader = pair.master.try_clone_reader().unwrap();
        let drain = {
            let output = output.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 1024];
                while let Ok(n) = reader.read(&mut buf) {
                    if n == 0 {
                        break;
                    }
                    output.lock().unwrap().extend_from_slice(&buf[..n]);
                }
            })
        };

        // A line typed but not entered; the tty echoes it back once received.
        let pending = format!("touch {}", marker.display());
        let mut writer = master_writer(&*pair.master).unwrap();
        writer.write_all(pending.as_bytes()).unwrap();
        writer.flush().unwrap();
        assert!(
            wait_until(Duration::from_secs(5), || {
                String::from_utf8_lossy(&output.lock().unwrap()).contains(&pending)
            }),
            "shell never echoed the pending input"
        );

        let (input_tx, _input_rx) = std::sync::mpsc::channel::<Vec<u8>>();
        let session = Session {
            master: pair.master,
            input_tx,
            flow: Arc::new(FlowControl::new()),
            child_killer: child.clone_killer(),
            shell_process_id: child.process_id(),
            shell_type: "Bash".to_string(),
            line_editor_pipe_name: None,
            line_editor_channel: None,
        };
        release_session(session);
        drop(writer);

        assert!(
            wait_until(Duration::from_secs(5), || child
                .try_wait()
                .map(|status| status.is_some())
                .unwrap_or(true)),
            "shell is still running after the session was released"
        );
        drain.join().unwrap();
        assert!(
            !marker.exists(),
            "the pending line was entered when the session was released"
        );
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use std::time::{Duration, Instant};

    /// Spawns `cmd` printing `lines` lines into a ConPTY whose reader stalls
    /// on tiny watermarks with nothing acknowledged, waits until it has
    /// stalled and the pipe behind it had time to fill, then returns what a
    /// session release needs.
    fn stalled_session(
        lines: u32,
    ) -> (
        Session,
        Box<dyn portable_pty::Child + Send + Sync>,
        std::thread::JoinHandle<()>,
    ) {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("cmd");
        cmd.args([
            "/C",
            &format!("for /L %i in (1,1,{lines}) do @echo line %i"),
        ]);
        let child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);

        let flow = Arc::new(FlowControl::with_watermarks(
            4 * MAX_CHUNK_SIZE,
            MAX_CHUNK_SIZE,
        ));
        let reader = pair.master.try_clone_reader().unwrap();
        let pump = {
            let flow = flow.clone();
            std::thread::spawn(move || pump_pty_output(reader, &flow, |_frame| true))
        };
        let started = Instant::now();
        while flow.in_flight() <= 4 * MAX_CHUNK_SIZE {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "reader never reached the high watermark"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        std::thread::sleep(Duration::from_millis(300));

        let (input_tx, _input_rx) = std::sync::mpsc::channel::<Vec<u8>>();
        let session = Session {
            master: pair.master,
            input_tx,
            flow,
            child_killer: child.clone_killer(),
            _job: None,
            shell_process_id: child.process_id(),
            shell_type: "PowerShell".to_string(),
            line_editor_pipe_name: None,
            line_editor_channel: None,
        };
        (session, child, pump)
    }

    fn assert_finishes(handle: std::thread::JoinHandle<()>, what: &str) {
        let started = Instant::now();
        while !handle.is_finished() {
            assert!(
                started.elapsed() < Duration::from_secs(15),
                "{what} is still running after 15 s"
            );
            std::thread::sleep(Duration::from_millis(50));
        }
        handle.join().unwrap();
    }

    /// Pane closed while the shell is still printing: the output pipe is
    /// full, the reader is blocked on flow control, nothing acknowledged.
    #[test]
    fn releasing_a_session_with_unread_output_returns() {
        let (session, _child, pump) = stalled_session(200_000);
        let release = std::thread::spawn(move || release_session(session));
        assert_finishes(release, "release_session");
        assert_finishes(pump, "reader thread");
    }

    /// Shell exited on its own with output nobody has read yet (the path
    /// end_session takes from the wait thread). Little enough output that
    /// the pipe behind the stalled reader can hold the rest of it.
    #[test]
    fn releasing_a_session_whose_shell_already_exited_returns() {
        let (session, mut child, pump) = stalled_session(500);
        let started = Instant::now();
        while child.try_wait().unwrap().is_none() {
            assert!(
                started.elapsed() < Duration::from_secs(15),
                "shell did not exit; the pipe may be blocking it"
            );
            std::thread::sleep(Duration::from_millis(50));
        }
        let release = std::thread::spawn(move || release_session(session));
        assert_finishes(release, "release_session");
        assert_finishes(pump, "reader thread");
    }
}
