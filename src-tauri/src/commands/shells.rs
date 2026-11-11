use cogno_host::protocol::{Request, Response, ShellInfo};
use tauri::State;

use crate::host::HostState;

/// The shells installed on this machine, offered as profiles on first start.
#[tauri::command]
pub async fn list_shells(host: State<'_, HostState>) -> Result<Vec<ShellInfo>, String> {
    // No answer means no shells to offer, as it always did.
    Ok(match host.request(Request::ListShells).await {
        Ok(Response::Shells(shells)) => shells,
        _ => Vec::new(),
    })
}
