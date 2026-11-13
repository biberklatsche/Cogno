use cogno_host::env_vars;
use cogno_host::protocol::{
    Request, SessionInfo, SessionLifetime, SessionPlacement, SpawnOptions, TerminalSize,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Manager, State};

use crate::command_error::CommandResult;
use crate::hosts::{HostState, SpawnRequest, Spawned};
use crate::http_server::HttpServerState;

/// How long a start waits for the HTTP server to decide whether it runs.
const HTTP_SERVER_PATIENCE: std::time::Duration = std::time::Duration::from_secs(2);

/// Starts a shell on this machine; on another one, Cogno only shows what
/// runs there.
#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    options: SpawnOptions,
    lifetime: SessionLifetime,
    on_data: Channel<InvokeResponseBody>,
) -> CommandResult<Spawned> {
    let env = http_server_environment(&app).await;
    hosts
        .spawn(SpawnRequest {
            options,
            window: window.label().to_string(),
            env,
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

/// HTTP server port and token, so hooks can reach cogno. The webview starts
/// the server and spawns terminals independently; a short wait for the
/// server's answer keeps the port out of a race it would lose on a cold start.
async fn http_server_environment(app: &AppHandle) -> Vec<(String, String)> {
    let server_state = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let http_server = server_state.state::<HttpServerState>();
        http_server.wait_for_start_decision(HTTP_SERVER_PATIENCE);
        match http_server.port() {
            0 => Vec::new(),
            port => vec![
                (env_vars::COGNO_PORT.to_string(), port.to_string()),
                (
                    env_vars::COGNO_TOKEN.to_string(),
                    http_server.token().to_string(),
                ),
            ],
        }
    })
    .await
    .unwrap_or_default()
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
    seq: u32,
) -> CommandResult<()> {
    hosts.acknowledge(window.label(), terminal_id, seq)
}
