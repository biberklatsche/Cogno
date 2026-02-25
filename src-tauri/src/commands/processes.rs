use std::collections::VecDeque;
use std::path::Path;

use serde::Serialize;
use sysinfo::{Pid, Process, System};
use tauri::State;

use super::pty::PtyState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDetails {
    pub process_id: u32,
    pub parent_process_id: Option<u32>,
    pub name: String,
    pub command: Vec<String>,
    pub executable_path: Option<String>,
    pub current_working_directory: Option<String>,
    pub root_directory: Option<String>,
    pub environment: Vec<String>,
    pub status: String,
    pub start_time_seconds: u64,
    pub run_time_seconds: u64,
    pub cpu_usage_percent: f32,
    pub memory_bytes: u64,
    pub virtual_memory_bytes: u64,
    pub disk_read_bytes: u64,
    pub disk_written_bytes: u64,
    pub total_disk_read_bytes: u64,
    pub total_disk_written_bytes: u64,
    pub user_id: Option<String>,
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTreeSnapshot {
    pub root_process_id: u32,
    pub direct_child_process_ids: Vec<u32>,
    pub descendant_process_ids: Vec<u32>,
    pub root_process: ProcessDetails,
    pub direct_children: Vec<ProcessDetails>,
    pub descendants: Vec<ProcessDetails>,
}

#[tauri::command]
pub fn pty_get_process_tree_by_pid(process_id: u32) -> Result<ProcessTreeSnapshot, String> {
    get_process_tree_snapshot(process_id)
}

#[tauri::command]
pub fn pty_get_process_tree_by_terminal_id(
    state: State<'_, PtyState>,
    terminal_id: String,
) -> Result<ProcessTreeSnapshot, String> {
    let shell_process_id = state.get_shell_process_id(&terminal_id).ok_or_else(|| {
        format!(
            "No shell process id found for terminal session: {}",
            terminal_id
        )
    })?;

    get_process_tree_snapshot(shell_process_id)
}

fn get_process_tree_snapshot(root_process_id: u32) -> Result<ProcessTreeSnapshot, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let root_pid = Pid::from_u32(root_process_id);
    let root_process = system
        .process(root_pid)
        .ok_or_else(|| format!("Process not found for pid {}", root_process_id))?;

    let direct_child_process_ids = collect_direct_child_process_ids(&system, root_pid);
    let descendant_process_ids = collect_descendant_process_ids(&system, root_pid);

    let root_process_details = map_process_to_details(root_process);
    let direct_children = collect_process_details(&system, &direct_child_process_ids);
    let descendants = collect_process_details(&system, &descendant_process_ids);

    Ok(ProcessTreeSnapshot {
        root_process_id,
        direct_child_process_ids,
        descendant_process_ids,
        root_process: root_process_details,
        direct_children,
        descendants,
    })
}

fn collect_direct_child_process_ids(system: &System, parent_process_id: Pid) -> Vec<u32> {
    system
        .processes()
        .iter()
        .filter_map(|(process_id, process)| {
            if process.parent() == Some(parent_process_id) {
                Some(process_id.as_u32())
            } else {
                None
            }
        })
        .collect()
}

fn collect_descendant_process_ids(system: &System, root_process_id: Pid) -> Vec<u32> {
    let mut descendant_process_ids: Vec<u32> = Vec::new();
    let mut queue: VecDeque<Pid> = VecDeque::new();
    queue.push_back(root_process_id);

    while let Some(parent_process_id) = queue.pop_front() {
        for (process_id, process) in system.processes() {
            if process.parent() == Some(parent_process_id) {
                descendant_process_ids.push(process_id.as_u32());
                queue.push_back(*process_id);
            }
        }
    }

    descendant_process_ids
}

fn collect_process_details(system: &System, process_ids: &[u32]) -> Vec<ProcessDetails> {
    process_ids
        .iter()
        .filter_map(|process_id| {
            let pid = Pid::from_u32(*process_id);
            system.process(pid).map(map_process_to_details)
        })
        .collect()
}

fn map_process_to_details(process: &Process) -> ProcessDetails {
    let disk_usage = process.disk_usage();

    ProcessDetails {
        process_id: process.pid().as_u32(),
        parent_process_id: process
            .parent()
            .map(|parent_process_id| parent_process_id.as_u32()),
        name: process.name().to_string_lossy().to_string(),
        command: process
            .cmd()
            .iter()
            .map(|argument| argument.to_string_lossy().to_string())
            .collect(),
        executable_path: process.exe().map(path_to_string),
        current_working_directory: process.cwd().map(path_to_string),
        root_directory: process.root().map(path_to_string),
        environment: process
            .environ()
            .iter()
            .map(|environment_variable| environment_variable.to_string_lossy().to_string())
            .collect(),
        status: format!("{:?}", process.status()),
        start_time_seconds: process.start_time(),
        run_time_seconds: process.run_time(),
        cpu_usage_percent: process.cpu_usage(),
        memory_bytes: process.memory(),
        virtual_memory_bytes: process.virtual_memory(),
        disk_read_bytes: disk_usage.read_bytes,
        disk_written_bytes: disk_usage.written_bytes,
        total_disk_read_bytes: disk_usage.total_read_bytes,
        total_disk_written_bytes: disk_usage.total_written_bytes,
        user_id: process
            .user_id()
            .map(|user_identifier| format!("{:?}", user_identifier)),
        group_id: process
            .group_id()
            .map(|group_identifier| format!("{:?}", group_identifier)),
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
