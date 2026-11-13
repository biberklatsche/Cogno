//! A shell in a PTY of its own: starting it, typing into it, sizing it and
//! ending it. What the shell writes is read by whoever started it.

use std::io::{Read, Write};
use std::sync::mpsc;

use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};

#[cfg(windows)]
use crate::process_job::ProcessJob;
use crate::protocol::{HostError, HostErrorCode, TerminalSize};

/// Where what is typed into a shell goes: its writer thread. PTY writes can
/// block (the shell stops reading while it is blocked writing its output),
/// so nobody else ever writes to the PTY directly.
#[derive(Clone)]
pub(crate) struct ShellInput(mpsc::Sender<Vec<u8>>);

impl ShellInput {
    /// Hands `bytes` to the writer thread. Never blocks.
    pub fn queue(&self, bytes: Vec<u8>) -> Result<(), HostError> {
        self.0
            .send(bytes)
            .map_err(|_| HostError::new(HostErrorCode::SessionClosing, "The shell is ending"))
    }
}

/// A shell that runs. Dropping it closes the PTY; `shut_down` ends the
/// shell first.
pub(crate) struct ShellProcess {
    master: Box<dyn MasterPty + Send>,
    input: ShellInput,
    /// Ends the shell: SIGHUP on Unix (what a closing terminal sends; the
    /// shell saves its history and hangs up its jobs), `TerminateProcess` on
    /// Windows (ConPTY does not end its clients when the console closes).
    /// Closing the master alone would not do it: the reader thread holds its
    /// own descriptor while blocked in `read`.
    killer: Box<dyn ChildKiller + Send + Sync>,
    /// Held only for its drop: ends the shell's whole process tree with the
    /// session, and with the process should Cogno abort (see `process_job`).
    #[cfg(windows)]
    _job: Option<ProcessJob>,
    pid: Option<u32>,
}

/// What starting a shell hands its starter: the shell, its process to wait
/// for, its output to read, and its input for the writer thread.
pub(crate) struct StartedShell {
    pub process: ShellProcess,
    pub child: Box<dyn Child + Send + Sync>,
    pub output: Box<dyn Read + Send>,
    pub input: InputWriter,
}

/// The end of a shell's input that the writer thread owns.
pub(crate) struct InputWriter {
    writer: Box<dyn Write + Send>,
    queued: mpsc::Receiver<Vec<u8>>,
}

impl InputWriter {
    /// Writes what is queued, in order, on a thread of its own, until the
    /// shell's `ShellInput` is gone. A failed write means the PTY is
    /// unusable (broken pipe once the console is gone, EIO on Unix):
    /// `on_failure` is told, so failed input never vanishes silently.
    pub fn spawn(mut self, on_failure: impl FnOnce(std::io::Error) + Send + 'static) {
        std::thread::spawn(move || {
            while let Ok(bytes) = self.queued.recv() {
                let written = self
                    .writer
                    .write_all(&bytes)
                    .and_then(|_| self.writer.flush());
                if let Err(error) = written {
                    on_failure(error);
                    return;
                }
            }
        });
    }
}

impl ShellProcess {
    /// Starts `command` in a new PTY of `size`.
    pub fn start(command: CommandBuilder, size: TerminalSize) -> Result<StartedShell, HostError> {
        let spawn_failed = |what: &str, error: &dyn std::fmt::Display| {
            HostError::new(HostErrorCode::SpawnFailed, format!("{what}: {error}"))
        };
        let pair = open_pty(size)?;
        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| spawn_failed("The shell could not be started", &error))?;
        let pid = child.process_id();
        let output = pair
            .master
            .try_clone_reader()
            .map_err(|error| spawn_failed("The PTY output could not be read", &error))?;
        let writer = master_writer(&*pair.master)?;
        let (sender, queued) = mpsc::channel();
        Ok(StartedShell {
            process: ShellProcess {
                killer: child.clone_killer(),
                master: pair.master,
                input: ShellInput(sender),
                #[cfg(windows)]
                _job: pid.and_then(join_job),
                pid,
            },
            child,
            output,
            input: InputWriter { writer, queued },
        })
    }

    pub fn input(&self) -> &ShellInput {
        &self.input
    }

    pub fn pid(&self) -> Option<u32> {
        self.pid
    }

    pub fn resize(&self, size: TerminalSize) -> Result<(), HostError> {
        self.master
            .resize(pty_size(size))
            .map_err(|error| HostError::io("The PTY could not be resized", error))
    }

    /// The process group that has the terminal: the job in the foreground, or
    /// the shell's own group while it sits at its prompt.
    #[cfg(unix)]
    pub fn foreground_process_group(&self) -> Option<i32> {
        self.master.process_group_leader()
    }

    /// Ends the shell and closes its PTY. Can block until the PTY's output
    /// is drained (closing a ConPTY): never call this while holding a lock.
    pub fn shut_down(mut self) {
        if let Err(error) = self.killer.kill() {
            // Already gone, or not ours to kill any more; nothing to do about
            // either.
            log::debug!(target: "pty", "kill of shell failed: {error}");
        }
    }
}

/// A shell that fails to join a job (a restricted job around Cogno itself)
/// still runs; it just ends the old way, by `TerminateProcess` alone.
#[cfg(windows)]
fn join_job(pid: u32) -> Option<ProcessJob> {
    ProcessJob::containing(pid)
        .inspect_err(|error| {
            log::warn!(target: "pty", "shell_pid={pid} could not join a job object: {error}");
        })
        .ok()
}

fn pty_size(size: TerminalSize) -> PtySize {
    PtySize {
        rows: size.rows,
        cols: size.cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// Held while a PTY is opened.
///
/// On Windows a pseudo console is a console host process that is handed the
/// PTY's pipes, and for the moment it is started those pipe handles are
/// inheritable. A process started in that moment with handle inheritance
/// on - a second console host, any `std::process::Command` - inherits them
/// too and keeps the PTY's output pipe open for as long as it lives: the
/// PTY's reader then sees no end when its console is closed, only when that
/// other process is gone. Under this lock no second PTY is opened in that
/// moment; a test that starts a long-lived process takes it for the start.
pub(crate) fn handle_inheritance_lock() -> std::sync::MutexGuard<'static, ()> {
    static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    crate::sync::lock(&LOCK)
}

/// Opens a PTY, one at a time across the process (`handle_inheritance_lock`).
fn open_pty(size: TerminalSize) -> Result<portable_pty::PtyPair, HostError> {
    let _one_at_a_time = handle_inheritance_lock();
    native_pty_system()
        .openpty(pty_size(size))
        .map_err(|error| HostError::new(HostErrorCode::SpawnFailed, format!("No PTY: {error}")))
}

/// The handle PTY input is written through. On Unix this is a plain duplicate
/// of the master descriptor: portable-pty's own writer sends a newline and EOF
/// to the shell when it is dropped, which would run whatever line the user had
/// typed but not yet entered when the pane closes.
#[cfg(unix)]
fn master_writer(master: &dyn MasterPty) -> Result<Box<dyn Write + Send>, HostError> {
    use std::os::unix::io::FromRawFd;

    let no_writer = |what: String| HostError::new(HostErrorCode::SpawnFailed, what);
    let fd = master
        .as_raw_fd()
        .ok_or_else(|| no_writer("The PTY has no descriptor".to_string()))?;
    // SAFETY: `fd` is the open master descriptor owned by `master`; `dup`
    // returns a new descriptor that the returned `File` then owns.
    let duplicate = unsafe { libc::dup(fd) };
    if duplicate < 0 {
        return Err(no_writer(format!(
            "The PTY could not be duplicated: {}",
            std::io::Error::last_os_error()
        )));
    }
    // SAFETY: `duplicate` is a descriptor this function owns.
    unsafe { libc::fcntl(duplicate, libc::F_SETFD, libc::FD_CLOEXEC) };
    // SAFETY: as above; the `File` takes it over.
    Ok(Box::new(unsafe { std::fs::File::from_raw_fd(duplicate) }))
}

#[cfg(windows)]
fn master_writer(master: &dyn MasterPty) -> Result<Box<dyn Write + Send>, HostError> {
    master.take_writer().map_err(|error| {
        HostError::new(
            HostErrorCode::SpawnFailed,
            format!("The PTY takes no input: {error}"),
        )
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    /// Waits up to `limit` for `condition`; the shell lives in another process.
    fn wait_until(limit: Duration, mut condition: impl FnMut() -> bool) -> bool {
        let started = Instant::now();
        while started.elapsed() < limit {
            if condition() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        condition()
    }

    #[test]
    fn shutting_down_hangs_up_the_shell_without_entering_the_pending_line() {
        let marker = std::env::temp_dir().join(format!(
            "cogno-pty-release-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_file(&marker);

        let mut command = CommandBuilder::new("sh");
        command.arg("-i");
        command.env("PS1", "$ ");
        let started = ShellProcess::start(command, TerminalSize { cols: 80, rows: 24 }).unwrap();
        let StartedShell {
            process,
            mut child,
            output: mut reader,
            input,
        } = started;

        // Drain output like the reader thread does, so the shell never blocks.
        let output = std::sync::Arc::new(std::sync::Mutex::new(Vec::<u8>::new()));
        let drain = {
            let output = output.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 1024];
                while let Ok(n) = reader.read(&mut buf) {
                    if n == 0 {
                        break;
                    }
                    output.lock().unwrap().extend_from_slice(&buf[..n]);
                }
            })
        };
        input.spawn(|_| {});

        // A line typed but not entered; the tty echoes it back once received.
        let pending = format!("touch {}", marker.display());
        process.input().queue(pending.clone().into_bytes()).unwrap();
        assert!(
            wait_until(Duration::from_secs(5), || {
                String::from_utf8_lossy(&output.lock().unwrap()).contains(&pending)
            }),
            "shell never echoed the pending input"
        );

        process.shut_down();

        assert!(
            wait_until(Duration::from_secs(5), || child
                .try_wait()
                .map(|status| status.is_some())
                .unwrap_or(true)),
            "shell is still running after it was shut down"
        );
        drain.join().unwrap();
        assert!(
            !marker.exists(),
            "the pending line was entered when the shell was shut down"
        );
    }
}
