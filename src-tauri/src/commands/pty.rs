use cogno_host::protocol::{
    Request, SessionInfo, SessionLifetime, SessionPlacement, SpawnOptions, TerminalSize,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::State;

use crate::command_error::CommandResult;
use crate::hosts::{HostState, SpawnRequest, Spawned};

/// Starts a shell on this machine; on another one, Cogno only shows what
/// runs there.
#[tauri::command]
pub async fn pty_spawn(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    options: SpawnOptions,
    lifetime: SessionLifetime,
    on_data: Channel<InvokeResponseBody>,
) -> CommandResult<Spawned> {
    hosts
        .spawn(SpawnRequest {
            options,
            window: window.label().to_string(),
            lifetime,
            on_data,
        })
        .await
}

/// Shows a shell that already runs on `host` in the calling window: what the
/// host kept of its output comes first, then what the shell writes. Whoever
/// showed it before is told that it was taken over.
#[tauri::command]
pub async fn pty_attach(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    host: Option<String>,
    on_data: Channel<InvokeResponseBody>,
) -> CommandResult<SessionInfo> {
    hosts
        .attach(host, terminal_id, window.label().to_string(), on_data)
        .await
}

/// Says where the shell sits in this Cogno (workspace, tab, title,
/// directory), for another Cogno to find it by.
#[tauri::command]
pub fn pty_place(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    placement: SessionPlacement,
) -> CommandResult<()> {
    hosts.post(
        window.label(),
        Request::PtyPlace {
            terminal_id,
            placement,
        },
    )
}

#[tauri::command]
pub fn pty_write(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    data: String,
) -> CommandResult<()> {
    hosts.post(window.label(), Request::PtyWrite { terminal_id, data })
}

/// Waited for: the caller wants to know that the shell has no line editor
/// to act on, and what it types next must come after. On a blocking worker:
/// the shell takes the action when it gets to it.
#[tauri::command]
pub async fn pty_execute_line_editor_action(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    action: String,
    payload_json: Option<String>,
) -> CommandResult<()> {
    hosts
        .request(
            window.label().to_string(),
            Request::PtyLineEditorAction {
                terminal_id,
                action,
                payload_json,
            },
        )
        .await
        .map(|_| ())
}

#[tauri::command]
pub fn pty_resize(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    size: TerminalSize,
) -> CommandResult<()> {
    hosts.post(window.label(), Request::PtyResize { terminal_id, size })
}

/// Stops showing a shell, which runs on: for one that belongs to the Cogno of
/// another machine.
#[tauri::command]
pub async fn pty_detach(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
) -> CommandResult<()> {
    hosts
        .request(
            window.label().to_string(),
            Request::PtyDetach { terminal_id },
        )
        .await
        .map(|_| ())
}

/// Ending a shell can block (closing a ConPTY waits for its output pipe).
#[tauri::command]
pub async fn pty_kill(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
) -> CommandResult<()> {
    hosts
        .request(window.label().to_string(), Request::PtyKill { terminal_id })
        .await
        .map(|_| ())
}

/// The webview's acknowledgement that it has taken in every chunk up to and
/// including `seq`.
#[tauri::command]
pub fn pty_ack(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    channel: u32,
    seq: u32,
) -> CommandResult<()> {
    hosts.acknowledge(window.label(), terminal_id, channel, seq)
}
