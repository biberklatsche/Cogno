use std::collections::VecDeque;

use serde::Serialize;
use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tauri::State;

use super::pty::PtyState;

/// What the process-info panel shows about one process - nothing more, so a
/// snapshot does not read every process's environment or command line.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDetails {
    pub process_id: u32,
    pub parent_process_id: Option<u32>,
    pub name: String,
    pub current_working_directory: Option<String>,
    pub status: String,
    pub run_time_seconds: u64,
    pub memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTreeSnapshot {
    pub root_process_id: u32,
    pub root_process: ProcessDetails,
    pub descendants: Vec<ProcessDetails>,
}

/// Enumerating the machine's processes takes a while; it runs on a blocking
/// worker, never on the thread that drives the UI.
#[tauri::command]
pub async fn pty_get_process_tree_by_terminal_id(
    state: State<'_, PtyState>,
    terminal_id: String,
) -> Result<ProcessTreeSnapshot, String> {
    let shell_process_id = state.get_shell_process_id(&terminal_id).ok_or_else(|| {
        format!(
            "No shell process id found for terminal session: {}",
            terminal_id
        )
    })?;

    tauri::async_runtime::spawn_blocking(move || get_process_tree_snapshot(shell_process_id))
        .await
        .map_err(|error| error.to_string())?
}

fn get_process_tree_snapshot(root_process_id: u32) -> Result<ProcessTreeSnapshot, String> {
    let mut system = System::new();
    // One pass over the processes, reading only what the panel shows. Name,
    // parent, status and run time come with every refresh.
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing()
            .with_memory()
            .with_cwd(UpdateKind::Always),
    );

    let root_pid = Pid::from_u32(root_process_id);
    let root_process = system
        .process(root_pid)
        .ok_or_else(|| format!("Process not found for pid {}", root_process_id))?;

    let descendants = collect_descendant_process_ids(&system, root_pid)
        .into_iter()
        .filter_map(|process_id| system.process(process_id).map(map_process_to_details))
        .collect();

    Ok(ProcessTreeSnapshot {
        root_process_id,
        root_process: map_process_to_details(root_process),
        descendants,
    })
}

fn collect_descendant_process_ids(system: &System, root_process_id: Pid) -> Vec<Pid> {
    let mut descendant_process_ids: Vec<Pid> = Vec::new();
    let mut queue: VecDeque<Pid> = VecDeque::new();
    queue.push_back(root_process_id);

    while let Some(parent_process_id) = queue.pop_front() {
        for (process_id, process) in system.processes() {
            if process.parent() == Some(parent_process_id) {
                descendant_process_ids.push(*process_id);
                queue.push_back(*process_id);
            }
        }
    }

    descendant_process_ids
}

fn map_process_to_details(process: &Process) -> ProcessDetails {
    ProcessDetails {
        process_id: process.pid().as_u32(),
        parent_process_id: process.parent().map(|parent| parent.as_u32()),
        name: process.name().to_string_lossy().to_string(),
        current_working_directory: process
            .cwd()
            .map(|path| path.to_string_lossy().to_string()),
        status: format!("{:?}", process.status()),
        run_time_seconds: process.run_time(),
        memory_bytes: process.memory(),
    }
}
