use cogno_host::protocol::{Attached, IntegrationFile, Request, Response, SessionInfo, ShellInfo};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::command_error::{CommandError, CommandResult};
use crate::hosts::HostState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    /// "windows", "macos" or "linux".
    pub os: String,
}

/// Connects to the paired machine `id`, unless the connection already
/// stands (ARCHITECTURE.md 2.7.3).
#[tauri::command]
pub async fn host_connect(app: AppHandle, id: String) -> CommandResult<HostInfo> {
    let pairing = app
        .state::<crate::commands::pairing::PairingState>()
        .pairing()?
        .clone();
    let connecting = app.clone();
    let connected = tauri::async_runtime::spawn_blocking(move || {
        let connection = connecting.state::<HostState>().connect(&id, &pairing)?;
        Ok(HostInfo {
            os: connection.os().to_string(),
        })
    })
    .await;
    connected.map_err(CommandError::internal)?
}

/// The shells installed on this machine: offered as profiles on first start.
#[tauri::command]
pub async fn list_shells(hosts: State<'_, HostState>) -> CommandResult<Vec<ShellInfo>> {
    match hosts.request_on(None, Request::ListShells).await? {
        Response::Shells { shells } => Ok(shells),
        _ => Err(CommandError::unexpected_reply()),
    }
}

/// A shell that runs on a host, as the calling window sees it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeenSession {
    #[serde(flatten)]
    session: SessionInfo,
    /// Whether the calling window is the one that shows it. The host only
    /// knows the app; the app knows its windows - also right after a
    /// window's webview was loaded again, when nothing in it remembers.
    shown_in_this_window: bool,
}

impl SeenSession {
    fn by(window: &tauri::Window, hosts: &HostState, session: SessionInfo) -> Self {
        let shown_in_this_window = session.attached == Attached::ThisClient
            && hosts.shows(window.label(), &session.terminal_id);
        Self {
            session,
            shown_in_this_window,
        }
    }
}

/// The shells that run on a host, this machine when none is named: what a
/// Cogno that starts or connects can go on with.
#[tauri::command]
pub async fn host_sessions(
    window: tauri::Window,
    hosts: State<'_, HostState>,
    host: Option<String>,
) -> CommandResult<Vec<SeenSession>> {
    match hosts.request_on(host, Request::ListSessions).await? {
        Response::Sessions { sessions } => Ok(sessions
            .into_iter()
            .map(|session| SeenSession::by(&window, &hosts, session))
            .collect()),
        _ => Err(CommandError::unexpected_reply()),
    }
}

/// The shell `terminal_id` that runs on a host, this machine when none is
/// named: what a pane needs to know of it before it attaches.
#[tauri::command]
pub async fn host_session(
    window: tauri::Window,
    hosts: State<'_, HostState>,
    host: Option<String>,
    terminal_id: String,
) -> CommandResult<SeenSession> {
    match hosts
        .request_on(host, Request::GetSession { terminal_id })
        .await?
    {
        Response::Session { session } => Ok(SeenSession::by(&window, &hosts, *session)),
        _ => Err(CommandError::unexpected_reply()),
    }
}

/// Ends a shell on a host on another machine - also one that no window of
/// this Cogno shows.
#[tauri::command]
pub async fn host_kill_session(
    hosts: State<'_, HostState>,
    host: String,
    terminal_id: String,
) -> CommandResult<()> {
    hosts.kill_session(host, terminal_id).await
}

/// Hangs up on a host on another machine, or gives up connecting to it.
#[tauri::command]
pub async fn host_disconnect(hosts: State<'_, HostState>, id: String) -> CommandResult<()> {
    hosts.disconnect(id).await;
    Ok(())
}

/// Makes sure the shell integration scripts of `version` lie in this
/// machine's Cogno home. The scripts are this Cogno's, so they and what it
/// reads from the shells always agree.
#[tauri::command]
pub async fn host_install_shell_integration(
    hosts: State<'_, HostState>,
    version: String,
    files: Vec<IntegrationFile>,
) -> CommandResult<()> {
    hosts
        .request_on(None, Request::InstallShellIntegration { version, files })
        .await
        .map(|_| ())
}
