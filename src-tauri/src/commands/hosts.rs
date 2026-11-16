use cogno_host::daemon_start::remote_commands;
use cogno_host::identity;
use cogno_host::protocol::{IntegrationFile, Request, Response, SessionInfo, ShellInfo};
use serde::Serialize;
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::commands::askpass::{point_ssh_at_helper, AskpassState};
use crate::hosts::HostState;

/// How often ssh asks the other machine whether it is still there, and how
/// many unanswered questions end the connection: a dead connection ends
/// within a minute instead of hanging until the next keystroke.
const KEEP_ALIVE_INTERVAL: Duration = Duration::from_secs(15);
const KEEP_ALIVE_MISSES: u32 = 3;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    /// "windows", "macos" or "linux".
    pub os: String,
    /// The command that reached Cogno there, when the remote names none and
    /// the default one did not: worth remembering for the next time.
    pub found_command: Option<String>,
}

/// The Cogno home on the other machine that the default command starts the
/// bridge from: a development build talks to development builds.
fn remote_home_directory_name() -> &'static str {
    if cfg!(debug_assertions) {
        identity::DEVELOPMENT_HOME_DIRECTORY_NAME
    } else {
        identity::HOME_DIRECTORY_NAME
    }
}

/// ssh to `destination`, running `remote_command` there with stdin and stdout
/// as the connection.
fn ssh_command(destination: &str, remote_command: &str) -> CommandResult<Command> {
    // A destination is a host, `user@host` or an ssh config alias: one word,
    // and never an option - "-oProxyCommand=..." would run a program on this
    // machine.
    if destination.is_empty()
        || destination.starts_with('-')
        || destination.contains(char::is_whitespace)
    {
        return Err(CommandError::new(
            AppErrorCode::InvalidDestination,
            format!("Not an ssh destination: {destination:?}"),
        ));
    }
    let mut command = Command::new("ssh");
    command.args([
        "-T",
        "-o",
        &format!("ServerAliveInterval={}", KEEP_ALIVE_INTERVAL.as_secs()),
        "-o",
        &format!("ServerAliveCountMax={KEEP_ALIVE_MISSES}"),
        "--",
        destination,
        remote_command,
    ]);
    cogno_host::console::without_console_window(&mut command);
    Ok(command)
}

/// Connects to the host `name` over ssh, unless the connection already
/// stands. What ssh asks on the way (a password, a passphrase, a host key)
/// reaches the calling window as an askpass prompt of `prompt_session`.
///
/// A remote that names no command is tried with each of `remote_commands`
/// in turn, as long as the one before did not reach Cogno: which one the
/// shell of the ssh server there takes is not known before.
#[tauri::command]
pub async fn host_connect(
    app: AppHandle,
    window: tauri::Window,
    name: String,
    destination: String,
    command: Option<String>,
    prompt_session: String,
) -> CommandResult<HostInfo> {
    let candidates = match command {
        Some(command) => vec![command],
        None => remote_commands(remote_home_directory_name()).to_vec(),
    };
    let askpass_token = app
        .state::<AskpassState>()
        .open_session(&prompt_session, window.label());

    let connecting = app.clone();
    let session = prompt_session.clone();
    let connected = tauri::async_runtime::spawn_blocking(move || {
        let hosts = connecting.state::<HostState>();
        // What ssh asks comes to this app: the host of this machine passes it
        // on. Without that host nothing can ask; a key still logs in.
        let owned = hosts.own_prompts(&session).is_ok();
        let connected = connect_trying(&hosts, &name, &destination, &candidates, |ssh| {
            point_ssh_at_helper(ssh, &session, &askpass_token);
        });
        if owned {
            hosts.disown_prompts(&session);
        }
        connected
    })
    .await;
    app.state::<AskpassState>()
        .close_session(&app, &prompt_session);

    connected.map_err(CommandError::internal)?
}

/// Connects with each of `candidates` in turn, as long as the one before did
/// not reach Cogno. `prepare` lets ssh ask through the app.
fn connect_trying(
    hosts: &HostState,
    name: &str,
    destination: &str,
    candidates: &[String],
    prepare: impl Fn(&mut Command),
) -> CommandResult<HostInfo> {
    let mut first_failure: Option<CommandError> = None;
    for (index, remote_command) in candidates.iter().enumerate() {
        let mut ssh = ssh_command(destination, remote_command)?;
        prepare(&mut ssh);
        match hosts.connect(name, ssh) {
            Ok(os) => {
                return Ok(HostInfo {
                    os,
                    found_command: (index > 0).then(|| remote_command.clone()),
                })
            }
            // The command did not reach Cogno: the next one may.
            Err(error) if error.is(AppErrorCode::NoCognoThere) => {
                first_failure.get_or_insert(error);
            }
            Err(error) => return Err(error),
        }
    }
    // What the default command met says the most.
    Err(first_failure.unwrap_or_else(|| CommandError::internal("No command to try")))
}

/// The shells installed on this machine: offered as profiles on first start.
#[tauri::command]
pub async fn list_shells(hosts: State<'_, HostState>) -> CommandResult<Vec<ShellInfo>> {
    match hosts.request_on(None, Request::ListShells).await? {
        Response::Shells { shells } => Ok(shells),
        _ => Err(CommandError::unexpected_reply()),
    }
}

/// The shells that run on a host, this machine when none is named: what a
/// Cogno that starts or connects can go on with.
#[tauri::command]
pub async fn host_sessions(
    hosts: State<'_, HostState>,
    host: Option<String>,
) -> CommandResult<Vec<SessionInfo>> {
    match hosts.request_on(host, Request::ListSessions).await? {
        Response::Sessions { sessions } => Ok(sessions),
        _ => Err(CommandError::unexpected_reply()),
    }
}

/// The shell `terminal_id` that runs on a host, this machine when none is
/// named: what a pane needs to know of it before it attaches.
#[tauri::command]
pub async fn host_session(
    hosts: State<'_, HostState>,
    host: Option<String>,
    terminal_id: String,
) -> CommandResult<SessionInfo> {
    match hosts
        .request_on(host, Request::GetSession { terminal_id })
        .await?
    {
        Response::Session { session } => Ok(*session),
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
pub fn host_disconnect(hosts: State<'_, HostState>, name: String) {
    hosts.disconnect(&name);
}

/// Ends this machine's host, whatever its version, and the shells in it: for
/// one from an older Cogno that this one cannot talk to. The next terminal
/// starts a host of this Cogno.
#[tauri::command]
pub async fn host_end_local(hosts: State<'_, HostState>) -> CommandResult<()> {
    hosts.end_local_host().await
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

#[cfg(test)]
mod tests {
    use super::*;
    use cogno_host::daemon_start::default_remote_command;

    #[test]
    fn a_destination_is_never_taken_for_an_option() {
        let command = default_remote_command(remote_home_directory_name());
        for not_a_destination in ["-oProxyCommand=calc", "", "mac extra"] {
            let refused = ssh_command(not_a_destination, &command).unwrap_err();
            assert!(refused.is(AppErrorCode::InvalidDestination));
        }

        let ssh = ssh_command("lars@macbook", &command).unwrap();
        let args: Vec<_> = ssh
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect();
        assert_eq!(&args[args.len() - 3..], ["--", "lars@macbook", &command]);
    }

    #[test]
    fn the_default_command_starts_the_bridge_through_the_starter() {
        assert_eq!(
            default_remote_command(identity::HOME_DIRECTORY_NAME),
            "\".cogno/bin/cogno\" server --stdio"
        );
    }

    #[test]
    fn a_remote_without_a_command_is_tried_for_powershell_too() {
        assert_eq!(
            remote_commands(identity::HOME_DIRECTORY_NAME),
            [
                "\".cogno/bin/cogno\" server --stdio".to_string(),
                "& \".cogno/bin/cogno\" server --stdio".to_string(),
            ]
        );
    }
}
