use cogno_host::protocol::{IntegrationFile, Request, Response, SessionInfo, ShellInfo};
use serde::Serialize;
use std::process::Command;
use tauri::{AppHandle, Manager, State};

use crate::commands::askpass::{point_ssh_at_helper, AskpassState};
use crate::host::HostState;
use crate::http_server::HttpServerState;

/// What is started on the other machine when the host's config names
/// nothing else: the starter the Cogno there puts into its home, which is
/// where an ssh session begins. Written so that `cmd` and `sh` both take it:
/// a quoted path with forward slashes, without extension.
const DEFAULT_REMOTE_COMMAND: &str = "\".cogno/bin/cogno\" server --stdio";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    /// "windows", "macos" or "linux".
    pub os: String,
}

/// ssh to `destination`, running `remote_command` there with stdin and stdout
/// as the connection. The keep-alive makes a dead connection end within a
/// minute instead of hanging until the next keystroke.
fn ssh_command(destination: &str, remote_command: &str) -> Result<Command, String> {
    // A destination is a host, `user@host` or an ssh config alias - never an
    // option: "-oProxyCommand=..." would run a program on this machine.
    if destination.is_empty() || destination.starts_with('-') {
        return Err(format!("Not an ssh destination: {destination:?}"));
    }
    let mut command = Command::new("ssh");
    command.args([
        "-T",
        "-o",
        "ServerAliveInterval=15",
        "-o",
        "ServerAliveCountMax=3",
        "--",
        destination,
        remote_command,
    ]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    Ok(command)
}

/// Connects to the host `name` over ssh, unless the connection already
/// stands. What ssh asks on the way (a password, a passphrase, a host key)
/// reaches the calling window as an askpass prompt of `prompt_session`.
#[tauri::command]
pub async fn host_connect(
    app: AppHandle,
    window: tauri::Window,
    name: String,
    destination: String,
    command: Option<String>,
    prompt_session: String,
) -> Result<HostInfo, String> {
    let remote_command = command.as_deref().unwrap_or(DEFAULT_REMOTE_COMMAND);
    let mut ssh = ssh_command(&destination, remote_command)?;
    let askpass_token = app
        .state::<AskpassState>()
        .open_session(&prompt_session, window.label());
    let port = app.state::<HttpServerState>().port();
    point_ssh_at_helper(&mut ssh, port, &prompt_session, &askpass_token);

    let connecting = app.clone();
    let connected = tauri::async_runtime::spawn_blocking(move || {
        connecting.state::<HostState>().connect(&name, ssh)
    })
    .await;
    app.state::<AskpassState>()
        .close_session(&app, &prompt_session);

    let os = connected.map_err(|error| error.to_string())??;
    Ok(HostInfo { os })
}

/// The shells installed on a host, this machine when none is named: offered
/// as profiles on first start.
#[tauri::command]
pub async fn list_shells(
    hosts: State<'_, HostState>,
    host: Option<String>,
) -> Result<Vec<ShellInfo>, String> {
    match hosts.request_on(host, Request::ListShells).await? {
        Response::Shells(shells) => Ok(shells),
        _ => Err("The host answered something else".to_string()),
    }
}

/// The shells that run on a host, this machine when none is named: what a
/// Cogno that starts or connects can go on with.
#[tauri::command]
pub async fn host_sessions(
    hosts: State<'_, HostState>,
    host: Option<String>,
) -> Result<Vec<SessionInfo>, String> {
    match hosts.request_on(host, Request::ListSessions).await? {
        Response::Sessions(sessions) => Ok(sessions),
        _ => Err("The host answered something else".to_string()),
    }
}

/// Makes sure the shell integration scripts of `version` lie on a host, this
/// machine when none is named. The scripts are this Cogno's: a host on
/// another machine gets them from here, so both sides agree on them.
#[tauri::command]
pub async fn host_install_shell_integration(
    hosts: State<'_, HostState>,
    host: Option<String>,
    version: String,
    files: Vec<IntegrationFile>,
    dev_mode: bool,
) -> Result<(), String> {
    hosts
        .request_on(
            host,
            Request::InstallShellIntegration {
                dev_mode,
                version,
                files,
            },
        )
        .await
        .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_destination_is_never_taken_for_an_option() {
        assert!(ssh_command("-oProxyCommand=calc", DEFAULT_REMOTE_COMMAND).is_err());
        assert!(ssh_command("", DEFAULT_REMOTE_COMMAND).is_err());

        let command = ssh_command("lars@macbook", DEFAULT_REMOTE_COMMAND).unwrap();
        let args: Vec<_> = command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();
        assert_eq!(
            &args[args.len() - 3..],
            ["--", "lars@macbook", "\".cogno/bin/cogno\" server --stdio"]
        );
    }
}
