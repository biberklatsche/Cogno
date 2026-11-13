//! The processes under the terminals' shells: what runs there, for the
//! process panel and the coding agents, and ending them on request.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

#[cfg(unix)]
use sysinfo::Signal;
use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use crate::protocol::{
    HostError, HostErrorCode, ProcessDetails, ProcessStatus, ProcessTreeSnapshot, TerminalProcess,
};

/// The processes under every terminal's shell, in one pass over the machine.
///
/// Reading a process's cwd is the costly part (on Windows it reads the
/// process's memory), so the machine is walked without it first and only the
/// processes under the terminals' shells get their cwd read.
pub(crate) fn list_terminal_processes(shells: &[(String, u32)]) -> Vec<TerminalProcess> {
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

/// Enumerating the machine's processes takes a while: never call this on the
/// thread that drives the UI.
pub(crate) fn get_process_tree_snapshot(
    root_process_id: u32,
) -> Result<ProcessTreeSnapshot, HostError> {
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
    let root_process = system.process(root_pid).ok_or_else(|| {
        HostError::new(
            HostErrorCode::ProcessNotFound,
            format!("No process runs under the id {root_process_id}"),
        )
    })?;

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
/// so a client cannot end arbitrary processes.
pub(crate) fn terminate_process_tree(
    root_process_id: u32,
    target_process_id: u32,
) -> Result<(), HostError> {
    let system = all_processes();

    let target_pid = Pid::from_u32(target_process_id);
    if !collect_descendant_process_ids(&system, Pid::from_u32(root_process_id))
        .contains(&target_pid)
    {
        return Err(HostError::new(
            HostErrorCode::NotInTerminalTree,
            format!("Process {target_process_id} does not run under this terminal's shell"),
        ));
    }

    end(
        &system,
        std::iter::once(target_pid).chain(collect_descendant_process_ids(&system, target_pid)),
        &format!("process {}", target_process_id),
    )
}

/// Ends what runs in the foreground of a terminal - the job the user would
/// stop with Ctrl+C, also where it ignores that. The shell stays, and so does
/// what it keeps beside the job: background jobs and the helpers of a prompt.
/// `foreground_group` is the process group that has the terminal.
#[cfg(unix)]
pub(crate) fn terminate_foreground_job(
    shell_process_id: u32,
    foreground_group: i32,
    terminal_id: &str,
) -> Result<(), HostError> {
    let system = all_processes();
    let job = foreground_job(&system, Pid::from_u32(shell_process_id), foreground_group);
    end(
        &system,
        job,
        &format!("the processes of terminal {terminal_id}"),
    )
}

/// Ends everything under a terminal's shell; the shell stays. What Windows
/// does in place of ending the foreground job, which it does not have.
#[cfg(windows)]
pub(crate) fn terminate_processes_under(
    shell_process_id: u32,
    terminal_id: &str,
) -> Result<(), HostError> {
    let system = all_processes();
    let everything = collect_descendant_process_ids(&system, Pid::from_u32(shell_process_id));
    end(
        &system,
        everything,
        &format!("the processes of terminal {terminal_id}"),
    )
}

/// The processes under the shell that belong to the terminal's foreground
/// process group, each with everything it started. Empty while the shell
/// itself is in the foreground: it sits at its prompt.
#[cfg(unix)]
fn foreground_job(system: &System, shell_pid: Pid, foreground_group: i32) -> Vec<Pid> {
    let mut job: Vec<Pid> = Vec::new();
    for pid in collect_descendant_process_ids(system, shell_pid) {
        if job.contains(&pid) || process_group_of(pid) != Some(foreground_group) {
            continue;
        }
        job.push(pid);
        for descendant in collect_descendant_process_ids(system, pid) {
            if !job.contains(&descendant) {
                job.push(descendant);
            }
        }
    }
    job
}

#[cfg(unix)]
fn process_group_of(pid: Pid) -> Option<i32> {
    // SAFETY: `getpgid` only reads the process table; a pid that is gone gives -1.
    let group = unsafe { libc::getpgid(pid.as_u32() as libc::pid_t) };
    (group >= 0).then_some(group)
}

fn all_processes() -> System {
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    system
}

/// Ends the processes and says how many would not go.
fn end(
    system: &System,
    process_ids: impl IntoIterator<Item = Pid>,
    what: &str,
) -> Result<(), HostError> {
    let targets = process_ids
        .into_iter()
        .filter_map(|pid| {
            system
                .process(pid)
                .map(|process| (pid, process.start_time()))
        })
        .collect();
    let survivors = terminate(targets);
    if survivors.is_empty() {
        Ok(())
    } else {
        Err(HostError::new(
            HostErrorCode::ProcessesSurvived,
            format!(
                "Could not terminate {what}: {} process(es) still running",
                survivors.len()
            ),
        ))
    }
}

/// On Unix the targets are asked to end (SIGTERM) and killed (SIGKILL) only
/// where they have not after the grace period; Windows has no polite way and
/// kills at once. Returns the ones still alive.
fn terminate(targets: Vec<Target>) -> Vec<Target> {
    #[cfg(unix)]
    let targets = signal_and_wait(
        targets,
        |process| {
            process.kill_with(Signal::Term);
        },
        TERMINATE_GRACE,
    );
    signal_and_wait(
        targets,
        |process| {
            process.kill();
        },
        KILL_SETTLE,
    )
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
                        sysinfo::ProcessStatus::Zombie | sysinfo::ProcessStatus::Dead
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
        status: status_of(process.status()),
        run_time_seconds: process.run_time(),
        memory_bytes: process.memory(),
    }
}

/// The status as the protocol names it, independent of `sysinfo`'s names.
fn status_of(status: sysinfo::ProcessStatus) -> ProcessStatus {
    use sysinfo::ProcessStatus as Sys;
    match status {
        Sys::Run => ProcessStatus::Running,
        Sys::Sleep | Sys::UninterruptibleDiskSleep => ProcessStatus::Sleeping,
        Sys::Idle => ProcessStatus::Idle,
        Sys::Stop | Sys::Tracing => ProcessStatus::Stopped,
        Sys::Zombie => ProcessStatus::Zombie,
        Sys::Dead => ProcessStatus::Dead,
        _ => ProcessStatus::Other,
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
        // Not while another test opens a PTY: this process would inherit its
        // pipe and hold it for the hundred seconds it runs.
        let _no_pty_opens = crate::shell_process::handle_inheritance_lock();
        crate::console::without_console_window(
            Command::new("cmd").args(["/C", "ping -n 100 127.0.0.1 >nul"]),
        )
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
        for outside in [shell.id(), std::process::id()] {
            let refused = terminate_process_tree(shell.id(), outside).unwrap_err();
            assert_eq!(refused.code, HostErrorCode::NotInTerminalTree);
        }
        assert_eq!(still_alive(&tree).1.len(), tree.len());

        assert_eq!(
            terminate_process_tree(std::process::id(), shell.id()),
            Ok(())
        );
        let _ = shell.wait();
    }

    #[cfg(unix)]
    #[test]
    fn takes_only_the_foreground_group_as_the_job() {
        use std::os::unix::process::CommandExt;
        // A group of its own, as a shell gives each job.
        let mut job = Command::new("sh")
            .args(["-c", "sleep 100 & wait"])
            .process_group(0)
            .spawn()
            .unwrap();
        let tree = tree_of(&job);
        let system = all_processes();
        let root = Pid::from_u32(std::process::id());
        let job_group = job.id() as i32;

        let mut found = foreground_job(&system, root, job_group);
        found.sort();
        let mut expected: Vec<Pid> = tree.iter().map(|(pid, _)| *pid).collect();
        expected.sort();
        assert_eq!(found, expected);
        // With the test process's own group in the foreground the job is not part of it.
        let own_group = process_group_of(root).unwrap();
        assert!(!foreground_job(&system, root, own_group).contains(&Pid::from_u32(job.id())));

        let _ = job.kill();
        let _ = job.wait();
        let _ = terminate(tree);
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
