use cogno_host::protocol::{PtySpawnResult, Request, Response, SessionLabel, SpawnOptions};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Manager, State};

use crate::host::{HostState, SpawnError};
use crate::http_server::HttpServerState;

/// What a request without a result of its own answers.
fn done(reply: Result<Response, String>) -> Result<(), String> {
    reply.map(|_| ())
}

/// Starts a shell on this machine; on another one, Cogno only shows what
/// runs there. `survives_client`: whether it goes on when Cogno is gone, to
/// be attached to again.
#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    options: SpawnOptions,
    survives_client: bool,
    on_data: Channel<InvokeResponseBody>,
) -> Result<PtySpawnResult, SpawnError> {
    let env = http_server_environment(&app).await;
    hosts
        .spawn(
            options,
            window.label().to_string(),
            env,
            survives_client,
            on_data,
        )
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
) -> Result<(), String> {
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
        http_server.wait_for_start_decision(std::time::Duration::from_secs(2));
        match http_server.port() {
            0 => Vec::new(),
            port => vec![
                ("COGNO_PORT".to_string(), port.to_string()),
                ("COGNO_TOKEN".to_string(), http_server.token().to_string()),
            ],
        }
    })
    .await
    .unwrap_or_default()
}

/// Says where the shell sits in this Cogno (workspace, tab, title,
/// directory), for another Cogno to find it by.
#[tauri::command]
pub fn pty_label(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
    label: SessionLabel,
) -> Result<(), String> {
    host.post(window.label(), Request::PtyLabel { terminal_id, label })
}

#[tauri::command]
pub fn pty_write(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    host.post(window.label(), Request::PtyWrite { terminal_id, data })
}

#[tauri::command]
pub fn pty_execute_line_editor_action(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
    action: String,
    payload_json: Option<String>,
) -> Result<(), String> {
    // Waited for, on this thread: the caller wants to know that the shell
    // has no line editor to act on, and what it types next must come after.
    done(host.ask(
        window.label(),
        Request::PtyLineEditorAction {
            terminal_id,
            action,
            payload_json,
        },
    ))
}

#[tauri::command]
pub fn pty_resize(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    host.post(
        window.label(),
        Request::PtyResize {
            terminal_id,
            cols,
            rows,
        },
    )
}

/// Stops showing a shell, which runs on: for one that belongs to the Cogno of
/// another machine.
#[tauri::command]
pub async fn pty_detach(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
) -> Result<(), String> {
    done(
        host.request(
            window.label().to_string(),
            Request::PtyDetach { terminal_id },
        )
        .await,
    )
}

/// Releasing a session can block (closing a ConPTY waits for its output pipe).
#[tauri::command]
pub async fn pty_kill(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
) -> Result<(), String> {
    done(
        host.request(window.label().to_string(), Request::PtyKill { terminal_id })
            .await,
    )
}

/// Frontend acknowledgement that xterm has parsed every chunk up to and
/// including `seq`.
#[tauri::command]
pub fn pty_ack(
    window: tauri::WebviewWindow,
    host: State<'_, HostState>,
    terminal_id: String,
    seq: u32,
) -> Result<(), String> {
    host.post(window.label(), Request::PtyAck { terminal_id, seq })
}
