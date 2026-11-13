use cogno_host::protocol::{ProcessTreeSnapshot, Request, Response, TerminalProcess};
use tauri::State;

use crate::command_error::{CommandError, CommandResult};
use crate::hosts::HostState;

/// The processes under every terminal's shell.
#[tauri::command]
pub async fn pty_list_terminal_processes(
    hosts: State<'_, HostState>,
) -> CommandResult<Vec<TerminalProcess>> {
    hosts.terminal_processes().await
}

#[tauri::command]
pub async fn pty_get_process_tree_by_terminal_id(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
) -> CommandResult<ProcessTreeSnapshot> {
    match hosts
        .request(
            window.label().to_string(),
            Request::ProcessTree { terminal_id },
        )
        .await?
    {
        Response::ProcessTree { snapshot } => Ok(*snapshot),
        _ => Err(CommandError::unexpected_reply()),
    }
}

/// Ends one process under a terminal's shell together with everything it
/// started.
#[tauri::command]
pub async fn pty_terminate_process(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
    process_id: u32,
) -> CommandResult<()> {
    hosts
        .request(
            window.label().to_string(),
            Request::TerminateProcess {
                terminal_id,
                process_id,
            },
        )
        .await
        .map(|_| ())
}

/// Ends what runs in the foreground of a terminal; the shell and its
/// background jobs stay. On Windows everything under the shell ends.
#[tauri::command]
pub async fn pty_terminate_foreground_job(
    window: tauri::WebviewWindow,
    hosts: State<'_, HostState>,
    terminal_id: String,
) -> CommandResult<()> {
    hosts
        .request(
            window.label().to_string(),
            Request::TerminateForegroundJob { terminal_id },
        )
        .await
        .map(|_| ())
}
