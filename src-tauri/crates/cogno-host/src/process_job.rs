//! Keeps a process and everything it starts in one Windows job object, so
//! the whole tree can be ended at once: `TerminateProcess` on the root
//! alone never reached grandchildren. A shell's job kills its members when
//! its handle closes; the handle lives in the session, so the tree ends with
//! the pane, and the OS closes it when Cogno dies, so an abort or crash takes
//! the shells down too. A command run's job is only terminated on demand (a
//! timeout): what the command started may legitimately outlive it.
use winapi::shared::minwindef::{DWORD, FALSE};
use winapi::um::handleapi::CloseHandle;
use winapi::um::jobapi2::{
    AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject, TerminateJobObject,
};
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::winnt::{
    JobObjectExtendedLimitInformation, HANDLE, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
};

pub struct ProcessJob {
    handle: HANDLE,
}

// A job handle is a plain kernel handle; using it from another thread is fine.
unsafe impl Send for ProcessJob {}
unsafe impl Sync for ProcessJob {}

impl ProcessJob {
    /// Puts the process (and from then on everything it starts) into a new
    /// job that kills its members when the returned value is dropped.
    pub fn containing(process_id: u32) -> std::io::Result<Self> {
        Self::create(process_id, true)
    }

    /// Puts the process (and from then on everything it starts) into a new
    /// job whose members live on when the value is dropped; `terminate`
    /// ends them all.
    pub fn tracking(process_id: u32) -> std::io::Result<Self> {
        Self::create(process_id, false)
    }

    /// Ends every process in the job, now.
    pub fn terminate(&self) {
        unsafe { TerminateJobObject(self.handle, 1) };
    }

    fn create(process_id: u32, kill_on_close: bool) -> std::io::Result<Self> {
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
            if handle.is_null() {
                return Err(std::io::Error::last_os_error());
            }
            // Owns the handle from here on, so every early return closes it.
            let job = ProcessJob { handle };

            if kill_on_close {
                let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let set = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &mut limits as *mut _ as *mut _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
                );
                if set == 0 {
                    return Err(std::io::Error::last_os_error());
                }
            }

            let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, FALSE, process_id);
            if process.is_null() {
                return Err(std::io::Error::last_os_error());
            }
            let assigned = AssignProcessToJobObject(handle, process);
            let assign_error = std::io::Error::last_os_error();
            CloseHandle(process);
            if assigned == 0 {
                return Err(assign_error);
            }
            Ok(job)
        }
    }
}

impl Drop for ProcessJob {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.handle) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    use std::time::{Duration, Instant};
    use sysinfo::{Pid, ProcessesToUpdate, System};

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    fn ping_started_by(parent: u32) -> bool {
        let mut system = System::new();
        system.refresh_processes(ProcessesToUpdate::All, true);
        system.processes().values().any(|process| {
            process.parent() == Some(Pid::from_u32(parent))
                && process
                    .name()
                    .to_string_lossy()
                    .eq_ignore_ascii_case("ping.exe")
        })
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

    #[test]
    fn closing_the_job_ends_the_shell_and_what_it_started() {
        // The second ping starts well after the shell joined the job.
        let mut shell = Command::new("cmd")
            .args(["/C", "ping -n 2 127.0.0.1 >nul & ping -n 60 127.0.0.1 >nul"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .unwrap();
        let shell_pid = shell.id();
        let job = ProcessJob::containing(shell_pid).unwrap();
        assert!(
            wait_until(Duration::from_secs(5), || ping_started_by(shell_pid)),
            "the shell never started its child"
        );

        drop(job);

        assert!(
            wait_until(Duration::from_secs(5), || shell
                .try_wait()
                .map(|status| status.is_some())
                .unwrap_or(true)),
            "the shell outlived its job"
        );
        assert!(
            wait_until(Duration::from_secs(5), || !ping_started_by(shell_pid)),
            "the shell's child outlived the job"
        );
    }
}
