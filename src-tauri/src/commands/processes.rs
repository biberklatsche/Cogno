use std::collections::VecDeque;
use std::time::{Duration, Instant};

use serde::Serialize;
#[cfg(unix)]
use sysinfo::Signal;
use sysinfo::{
    Pid, Process, ProcessRefreshKind, ProcessStatus, ProcessesToUpdate, System, UpdateKind,
};
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

/// A process under one terminal's shell, as the coding-agents feature matches
/// an agent's session to its terminal (ARCHITECTURE.md 3.2): name and cwd to
/// find candidates, the start time to tell two apart.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProcess {
    pub terminal_id: String,
    pub name: String,
    pub current_working_directory: Option<String>,
    /// Unix seconds.
    pub started_at: u64,
}

/// The processes under every terminal's shell, in one pass over the machine.
#[tauri::command]
pub async fn pty_list_terminal_processes(
    state: State<'_, PtyState>,
) -> Result<Vec<TerminalProcess>, String> {
    let shells = state.shell_process_ids();
    tauri::async_runtime::spawn_blocking(move || list_terminal_processes(&shells))
        .await
        .map_err(|error| error.to_string())
}

/// Reading a process's cwd is the costly part (on Windows it reads the
/// process's memory), so the machine is walked without it first and only the
/// processes under the terminals' shells get their cwd read.
fn list_terminal_processes(shells: &[(String, u32)]) -> Vec<TerminalProcess> {
    let mut system = System::new();
    // Name, parent and start time come with every refresh.
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    let descendants: Vec<(&String, Vec<Pid>)> = shells
        .iter()
        .map(|(terminal_id, shell_pid)| {
            (
                terminal_id,
                collect_descendant_process_ids(&system, Pid::from_u32(*shell_pid)),
            )
        })
        .collect();
    let all: Vec<Pid> = descendants
        .iter()
        .flat_map(|(_, pids)| pids.clone())
        .collect();
    if all.is_empty() {
        return Vec::new();
    }
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&all),
        false,
        ProcessRefreshKind::nothing().with_cwd(UpdateKind::Always),
    );
    let mut processes = Vec::new();
    for (terminal_id, pids) in descendants {
        for pid in pids {
            let Some(process) = system.process(pid) else {
                continue;
            };
            processes.push(TerminalProcess {
                terminal_id: terminal_id.clone(),
                name: process.name().to_string_lossy().to_string(),
                current_working_directory: process
                    .cwd()
                    .map(|path| path.to_string_lossy().to_string()),
                started_at: process.start_time(),
            });
        }
    }
    processes
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

/// A process keeps naming its parent's pid after the parent is gone (always on
/// Windows), and the system hands that pid out again. A "child" older than its
/// parent is such a leftover and belongs to another tree.
///
/// The system lists its processes in no particular order, different on every
/// read. A parent's children come out oldest first (the pid settles a tie), so
/// two reads of the same tree give the same order.
fn collect_descendant_process_ids(system: &System, root_process_id: Pid) -> Vec<Pid> {
    let mut descendant_process_ids: Vec<Pid> = Vec::new();
    let mut queue: VecDeque<Pid> = VecDeque::new();
    queue.push_back(root_process_id);

    while let Some(parent_process_id) = queue.pop_front() {
        let parent_started_at = system
            .process(parent_process_id)
            .map(|parent| parent.start_time());
        let mut children: Vec<(u64, Pid)> = system
            .processes()
            .iter()
            .filter(|(_, process)| {
                process.parent() == Some(parent_process_id)
                    && parent_started_at.is_none_or(|started_at| process.start_time() >= started_at)
            })
            .map(|(process_id, process)| (process.start_time(), *process_id))
            .collect();
        children.sort_unstable();
        for (_, process_id) in children {
            descendant_process_ids.push(process_id);
            queue.push_back(process_id);
        }
    }

    descendant_process_ids
}

/// How long a process gets to end on its own after SIGTERM before it is killed.
#[cfg(unix)]
const TERMINATE_GRACE: Duration = Duration::from_secs(2);
/// How long a killed process may take to disappear from the process list.
const KILL_SETTLE: Duration = Duration::from_secs(1);
const LIVENESS_POLL: Duration = Duration::from_millis(100);

/// A process to end: its pid and start time, so a pid the system handed out
/// again in the meantime is never taken for it.
type Target = (Pid, u64);

/// Ends one process under a terminal's shell together with everything it
/// started. Only descendants of that shell are accepted - never the shell
/// itself (closing the terminal ends it) and never a process outside the tree,
/// so the webview cannot end arbitrary processes.
#[tauri::command]
pub async fn pty_terminate_process(
    state: State<'_, PtyState>,
    terminal_id: String,
    process_id: u32,
) -> Result<(), String> {
    let shell_process_id = state.get_shell_process_id(&terminal_id).ok_or_else(|| {
        format!(
            "No shell process id found for terminal session: {}",
            terminal_id
        )
    })?;

    tauri::async_runtime::spawn_blocking(move || {
        terminate_process_tree(shell_process_id, process_id)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// On Unix the tree is asked to end (SIGTERM) and killed (SIGKILL) only where
/// it has not after the grace period; Windows has no polite way and kills at once.
fn terminate_process_tree(root_process_id: u32, target_process_id: u32) -> Result<(), String> {
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());

    let target_pid = Pid::from_u32(target_process_id);
    if !collect_descendant_process_ids(&system, Pid::from_u32(root_process_id))
        .contains(&target_pid)
    {
        return Err(format!(
            "Process {} does not run under this terminal's shell",
            target_process_id
        ));
    }

    let targets: Vec<Target> = std::iter::once(target_pid)
        .chain(collect_descendant_process_ids(&system, target_pid))
        .filter_map(|pid| {
            system
                .process(pid)
                .map(|process| (pid, process.start_time()))
        })
        .collect();

    #[cfg(unix)]
    let targets = signal_and_wait(
        targets,
        |process| {
            process.kill_with(Signal::Term);
        },
        TERMINATE_GRACE,
    );
    let survivors = signal_and_wait(
        targets,
        |process| {
            process.kill();
        },
        KILL_SETTLE,
    );

    if survivors.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Could not terminate process {}: {} process(es) still running",
            target_process_id,
            survivors.len()
        ))
    }
}

/// Signals every target still alive and waits until all are gone or `patience`
/// is used up; returns the ones still alive.
fn signal_and_wait(
    targets: Vec<Target>,
    signal: impl Fn(&Process),
    patience: Duration,
) -> Vec<Target> {
    let (system, mut alive) = still_alive(&targets);
    for (pid, _) in &alive {
        if let Some(process) = system.process(*pid) {
            signal(process);
        }
    }
    let deadline = Instant::now() + patience;
    loop {
        alive = still_alive(&alive).1;
        if alive.is_empty() || Instant::now() >= deadline {
            return alive;
        }
        std::thread::sleep(LIVENESS_POLL);
    }
}

/// The targets that still run. A zombie has ended and only waits for its
/// parent to collect it, so it counts as gone.
fn still_alive(targets: &[Target]) -> (System, Vec<Target>) {
    let mut system = System::new();
    if targets.is_empty() {
        return (system, Vec::new());
    }
    let pids: Vec<Pid> = targets.iter().map(|(pid, _)| *pid).collect();
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&pids),
        true,
        ProcessRefreshKind::nothing(),
    );
    let alive = targets
        .iter()
        .copied()
        .filter(|(pid, started_at)| {
            system.process(*pid).is_some_and(|process| {
                process.start_time() == *started_at
                    && !matches!(
                        process.status(),
                        ProcessStatus::Zombie | ProcessStatus::Dead
                    )
            })
        })
        .collect();
    (system, alive)
}

fn map_process_to_details(process: &Process) -> ProcessDetails {
    ProcessDetails {
        process_id: process.pid().as_u32(),
        parent_process_id: process.parent().map(|parent| parent.as_u32()),
        name: process.name().to_string_lossy().to_string(),
        current_working_directory: process.cwd().map(|path| path.to_string_lossy().to_string()),
        status: format!("{:?}", process.status()),
        run_time_seconds: process.run_time(),
        memory_bytes: process.memory(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::{Child, Command};

    /// A shell that starts a long-running child of its own.
    #[cfg(unix)]
    fn shell_with_child(prelude: &str) -> Child {
        Command::new("sh")
            .args(["-c", &format!("{prelude}sleep 100 & wait")])
            .spawn()
            .unwrap()
    }

    #[cfg(windows)]
    fn shell_with_child(_prelude: &str) -> Child {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("cmd")
            .args(["/C", "ping -n 100 127.0.0.1 >nul"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .unwrap()
    }

    fn wait_until(limit: Duration, mut condition: impl FnMut() -> bool) -> bool {
        let started = Instant::now();
        while started.elapsed() < limit {
            if condition() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        condition()
    }

    /// The shell and what it started, once its child is up.
    fn tree_of(shell: &Child) -> Vec<Target> {
        let shell_pid = Pid::from_u32(shell.id());
        let mut tree = Vec::new();
        let started = wait_until(Duration::from_secs(5), || {
            let mut system = System::new();
            system.refresh_processes_specifics(
                ProcessesToUpdate::All,
                true,
                ProcessRefreshKind::nothing(),
            );
            let descendants = collect_descendant_process_ids(&system, shell_pid);
            tree = std::iter::once(shell_pid)
                .chain(descendants.iter().copied())
                .filter_map(|pid| {
                    system
                        .process(pid)
                        .map(|process| (pid, process.start_time()))
                })
                .collect();
            !descendants.is_empty()
        });
        assert!(started, "the shell never started its child");
        tree
    }

    #[test]
    fn ends_the_process_and_what_it_started() {
        let mut shell = shell_with_child("");
        let tree = tree_of(&shell);

        let result = terminate_process_tree(std::process::id(), shell.id());

        assert_eq!(result, Ok(()));
        assert!(still_alive(&tree).1.is_empty());
        let _ = shell.wait();
    }

    #[test]
    fn refuses_the_root_and_a_process_outside_its_tree() {
        let mut shell = shell_with_child("");
        let tree = tree_of(&shell);

        // The root itself, and the test process seen from the shell's tree.
        assert!(terminate_process_tree(shell.id(), shell.id()).is_err());
        assert!(terminate_process_tree(shell.id(), std::process::id()).is_err());
        assert_eq!(still_alive(&tree).1.len(), tree.len());

        assert_eq!(
            terminate_process_tree(std::process::id(), shell.id()),
            Ok(())
        );
        let _ = shell.wait();
    }

    #[cfg(unix)]
    #[test]
    fn kills_what_ignores_the_request_to_end() {
        // An ignored signal stays ignored in the child the shell starts.
        let mut shell = shell_with_child("trap '' TERM; ");
        let tree = tree_of(&shell);
        let started = Instant::now();

        let result = terminate_process_tree(std::process::id(), shell.id());

        assert_eq!(result, Ok(()));
        assert!(started.elapsed() >= TERMINATE_GRACE);
        assert!(still_alive(&tree).1.is_empty());
        let _ = shell.wait();
    }
}
