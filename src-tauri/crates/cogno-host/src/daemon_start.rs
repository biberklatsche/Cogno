//! Reaching this machine's daemon from a Cogno that wants to be its client:
//! connect to the one that runs, or start it - and put down the starter a
//! Cogno on another machine finds this one by.

use crate::daemon;
use std::fs::File;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// How long a daemon that was just started may take to answer.
const START_PATIENCE: Duration = Duration::from_secs(15);
/// How long a daemon whose process runs may take to answer before another
/// one is started.
const BUSY_PATIENCE: Duration = Duration::from_secs(5);
/// How often a starting or busy daemon is knocked on.
const KNOCK_INTERVAL: Duration = Duration::from_millis(50);
/// Held while a daemon is started, so two Cognos that come up together
/// start one.
const START_LOCK_FILE_NAME: &str = "host.lock";
/// The directory of the starter in the Cogno home (`put_down_starter`).
pub const STARTER_DIRECTORY: &str = "bin";
/// The Windows copies of the daemon's binary, one directory per build.
#[cfg(windows)]
const BUILDS_DIRECTORY: &str = "host";
#[cfg(windows)]
const DAEMON_BINARY_NAME: &str = "cogno.exe";
/// The argument that runs `cogno` as the daemon.
pub const DAEMON_ARGUMENT: &str = "daemon";
/// The starter's name (on Windows with `.cmd`): what a Cogno on another
/// machine runs through ssh.
pub const STARTER_NAME: &str = "cogno";
/// What the starter is given to run the bridge to the daemon.
pub const BRIDGE_ARGUMENTS: &str = "server --stdio";

/// A connection to this user's daemon, which is started from the calling
/// binary if none answers. `build` names that binary's build (its version).
///
/// A daemon whose process runs is given time to answer before another one
/// is started; that one takes over only if it still does not answer then
/// (`daemon::run`).
pub fn connect_or_start(dev_mode: bool, build: &str) -> Result<TcpStream, String> {
    let endpoint = daemon::endpoint_path(dev_mode)?;
    if let Ok(stream) = daemon::connect(&endpoint) {
        return Ok(stream);
    }
    let _one_start = take_start_lock(home_of(&endpoint)?)?;
    // Started by another Cogno meanwhile, or only slow to answer.
    let patience = if daemon::endpoint_process_runs(&endpoint) {
        BUSY_PATIENCE
    } else {
        Duration::ZERO
    };
    if let Some(stream) = knock(&endpoint, patience) {
        return Ok(stream);
    }
    let binary = daemon_binary(&endpoint, build)?;
    put_down_starter(&endpoint, &binary);
    start(&binary)?;
    knock(&endpoint, START_PATIENCE).ok_or_else(|| "The Cogno host did not start".to_string())
}

/// Connects to the daemon the endpoint file names, trying until `patience`
/// is used up; at least once.
fn knock(endpoint: &Path, patience: Duration) -> Option<TcpStream> {
    let started = Instant::now();
    loop {
        if let Ok(stream) = daemon::connect(endpoint) {
            return Some(stream);
        }
        if started.elapsed() >= patience {
            return None;
        }
        std::thread::sleep(KNOCK_INTERVAL);
    }
}

/// Ends this user's daemon of `dev_mode` and the shells in it, if it is one
/// this Cogno cannot talk to; one it can - another Cogno may have started
/// it meanwhile - is left alone. A daemon that is gone already is no
/// failure; a process that does not answer as the daemon is never touched.
pub fn end_incompatible_daemon(dev_mode: bool) -> Result<(), String> {
    let endpoint = daemon::endpoint_path(dev_mode)?;
    // Not while another Cogno starts one.
    let _one_start = take_start_lock(home_of(&endpoint)?)?;
    daemon::end_incompatible_daemon(&endpoint)
        .map_err(|error| format!("The Cogno host could not be ended: {error}"))
}

/// Waits for the start lock of the Cogno home `home` and holds it until the
/// returned file is dropped. The system lets go of it when the process ends,
/// whatever happens.
fn take_start_lock(home: &Path) -> Result<File, String> {
    std::fs::create_dir_all(home).map_err(|error| error.to_string())?;
    let file = File::options()
        .create(true)
        .truncate(false)
        .write(true)
        .open(home.join(START_LOCK_FILE_NAME))
        .map_err(|error| format!("Could not take the start lock: {error}"))?;
    file.lock()
        .map_err(|error| format!("Could not take the start lock: {error}"))?;
    Ok(file)
}

/// The Cogno home the endpoint file lies in.
fn home_of(endpoint: &Path) -> Result<&Path, String> {
    endpoint
        .parent()
        .ok_or_else(|| "The Cogno home could not be determined".to_string())
}

/// The binary the daemon runs from.
///
/// Elsewhere that is this one. On Windows a running program's file cannot be
/// replaced, and the daemon outlives the app: an update would fail on it, or
/// end it and every shell with it. So there the daemon runs from a copy that
/// belongs to this build, and the installed file stays free.
#[cfg(not(windows))]
fn daemon_binary(_endpoint: &Path, _build: &str) -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|error| error.to_string())
}

#[cfg(windows)]
fn daemon_binary(endpoint: &Path, build: &str) -> Result<PathBuf, String> {
    let this = std::env::current_exe().map_err(|error| error.to_string())?;
    let built = std::fs::metadata(&this)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |since| since.as_secs());
    let builds = home_of(endpoint)?.join(BUILDS_DIRECTORY);
    // Version and build time: two builds of one version are two binaries.
    let build = format!("{build}-{built}");
    let copy = builds.join(&build).join(DAEMON_BINARY_NAME);
    if !copy.is_file() {
        let directory = copy.parent().expect("joined above");
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        // Copied aside and renamed: a copy cut short (a crash, a full disk)
        // must never pass for the binary.
        let partial = directory.join(format!(
            "{DAEMON_BINARY_NAME}.{}",
            uuid::Uuid::new_v4().simple()
        ));
        let copied = std::fs::copy(&this, &partial).and_then(|_| std::fs::rename(&partial, &copy));
        if let Err(error) = copied {
            let _ = std::fs::remove_file(&partial);
            return Err(format!(
                "Could not copy Cogno to {}: {error}",
                copy.display()
            ));
        }
    }
    remove_other_builds(&builds, &build);
    Ok(copy)
}

/// The copies of earlier builds go, except one a daemon still runs from:
/// its file cannot be removed, and that is how it is told apart.
#[cfg(windows)]
fn remove_other_builds(builds: &Path, current: &str) {
    let Ok(entries) = std::fs::read_dir(builds) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_name() != current {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

/// The command ssh runs on the other machine when a remote names none: the
/// starter under the Cogno home `home_directory_name`, relative to the home
/// directory an ssh session begins in. Quoted and with forward slashes, it
/// starts in `cmd` as in `sh`.
pub fn default_remote_command(home_directory_name: &str) -> String {
    format!("\"{home_directory_name}/{STARTER_DIRECTORY}/{STARTER_NAME}\" {BRIDGE_ARGUMENTS}")
}

/// What is tried, in this order, when a remote names no command: the default
/// one, then the same for a Windows ssh server whose default shell is
/// PowerShell, which takes a quoted path only after its call operator.
pub fn remote_commands(home_directory_name: &str) -> [String; 2] {
    let default = default_remote_command(home_directory_name);
    let for_powershell = format!("& {default}");
    [default, for_powershell]
}

/// The starter: a fixed place in the Cogno home under which the daemon's
/// binary is found, whatever the install directory. A Cogno on another
/// machine starts it through ssh (`default_remote_command`). Failing to write
/// it only costs that.
fn put_down_starter(endpoint: &Path, binary: &Path) {
    let Ok(home) = home_of(endpoint) else {
        return;
    };
    let path = starter_path(home);
    let directory = home.join(STARTER_DIRECTORY);
    let content = starter(binary);
    let written = std::fs::create_dir_all(&directory).and_then(|_| std::fs::write(&path, content));
    #[cfg(unix)]
    let written = written.and_then(|_| {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
    });
    if let Err(error) = written {
        log::warn!(target: "host", "could not write the starter: {error}");
    }
}

/// Where the starter lies in the Cogno home `home`: what hooks and plugins
/// run to reach the host, whichever version of Cogno is installed.
pub fn starter_path(home: &Path) -> PathBuf {
    let name = if cfg!(windows) {
        format!("{STARTER_NAME}.cmd")
    } else {
        STARTER_NAME.to_string()
    };
    home.join(STARTER_DIRECTORY).join(name)
}

#[cfg(windows)]
fn starter(binary: &Path) -> String {
    format!("@\"{}\" %*\r\n", binary.display())
}

#[cfg(not(windows))]
fn starter(binary: &Path) -> String {
    // Single quotes keep every character of the path but the quote itself.
    let quoted = binary.display().to_string().replace('\'', "'\\''");
    format!("#!/bin/sh\nexec '{quoted}' \"$@\"\n")
}

/// Starts the daemon so that it outlives this app.
fn start(binary: &Path) -> Result<(), String> {
    let mut command = Command::new(binary);
    command
        .arg(DAEMON_ARGUMENT)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    detach(&mut command);
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not start the Cogno host: {error}"))
}

/// No console of its own and no part in this app's console group: closing
/// the app, or Ctrl+C in the terminal a development build runs in, is not
/// the daemon's business.
#[cfg(windows)]
fn detach(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
}

/// A session of its own: the daemon is not hung up with the app's terminal.
#[cfg(unix)]
fn detach(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    // SAFETY: `setsid` is async-signal-safe and touches nothing of this
    // process's memory; it runs in the child between fork and exec.
    unsafe {
        command.pre_exec(|| {
            libc::setsid();
            Ok(())
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_starter_runs_the_binary_with_what_it_was_given() {
        #[cfg(windows)]
        {
            let content = starter(Path::new(r"C:\Users\me\.cogno\host\1\cogno.exe"));
            assert_eq!(
                content,
                "@\"C:\\Users\\me\\.cogno\\host\\1\\cogno.exe\" %*\r\n"
            );
            assert_eq!(
                starter_path(Path::new(r"C:\Users\me\.cogno")),
                Path::new(r"C:\Users\me\.cogno\bin\cogno.cmd")
            );
        }
        #[cfg(not(windows))]
        {
            let content = starter(Path::new("/opt/it's here/cogno"));
            assert_eq!(
                content,
                "#!/bin/sh\nexec '/opt/it'\\''s here/cogno' \"$@\"\n"
            );
            assert_eq!(
                starter_path(Path::new("/home/me/.cogno")),
                Path::new("/home/me/.cogno/bin/cogno")
            );
        }
    }
}
