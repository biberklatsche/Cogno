use cogno_host::protocol::{ProcessTreeSnapshot, Request, Response, TerminalProcess};
use tauri::State;

use crate::host::HostState;

const UNEXPECTED: &str = "The host answered something else";

/// The processes under every terminal's shell.
#[tauri::command]
pub async fn pty_list_terminal_processes(
    host: State<'_, HostState>,
) -> Result<Vec<TerminalProcess>, String> {
    match host.request(Request::TerminalProcesses).await? {
        Response::TerminalProcesses(processes) => Ok(processes),
        _ => Err(UNEXPECTED.to_string()),
    }
}

#[tauri::command]
pub async fn pty_get_process_tree_by_terminal_id(
    host: State<'_, HostState>,
    terminal_id: String,
) -> Result<ProcessTreeSnapshot, String> {
    match host.request(Request::ProcessTree { terminal_id }).await? {
        Response::ProcessTree(snapshot) => Ok(snapshot),
        _ => Err(UNEXPECTED.to_string()),
    }
}

/// Ends one process under a terminal's shell together with everything it
/// started.
#[tauri::command]
pub async fn pty_terminate_process(
    host: State<'_, HostState>,
    terminal_id: String,
    process_id: u32,
) -> Result<(), String> {
    host.request(Request::TerminateProcess {
        terminal_id,
        process_id,
    })
    .await
    .map(|_| ())
}
