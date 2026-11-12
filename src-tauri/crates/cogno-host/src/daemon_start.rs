//! Reaching this machine's daemon from a Cogno that wants to be its client:
//! connect to the one that runs, or start it - and put down the starter a
//! Cogno on another machine finds this one by.

use crate::daemon;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// How long a daemon that was just started may take to answer.
const START_PATIENCE: Duration = Duration::from_secs(15);

/// A connection to this user's daemon, which is started from the calling
/// binary if none answers. `build` names that binary's build (its version).
pub fn connect_or_start(dev_mode: bool, build: &str) -> Result<TcpStream, String> {
    let endpoint = daemon::endpoint_path(dev_mode)?;
    if let Ok(stream) = daemon::connect(&endpoint) {
        return Ok(stream);
    }
    // Nothing answers there: what the file names is gone. Without it, the
    // waiting below sees the new daemon's endpoint as soon as it is written
    // instead of knocking on the old one's port.
    let _ = std::fs::remove_file(&endpoint);
    let binary = daemon_binary(&endpoint, build)?;
    put_down_starter(&endpoint, &binary);
    start(&binary)?;
    let started = Instant::now();
    loop {
        match daemon::connect(&endpoint) {
            Ok(stream) => return Ok(stream),
            Err(_) if started.elapsed() < START_PATIENCE => {
                std::thread::sleep(Duration::from_millis(50))
            }
            Err(error) => return Err(format!("The Cogno host did not start: {error}")),
        }
    }
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
    let builds = home_of(endpoint)?.join("host");
    // Version and build time: two builds of one version are two binaries.
    let build = format!("{build}-{built}");
    let copy = builds.join(&build).join("cogno.exe");
    if !copy.is_file() {
        let directory = copy.parent().expect("joined above");
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        std::fs::copy(&this, &copy)
            .map_err(|error| format!("Could not copy Cogno to {}: {error}", copy.display()))?;
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

/// The starter: a fixed place in the Cogno home under which the daemon's
/// binary is found, whatever the install directory. A Cogno on another
/// machine starts `".cogno/bin/cogno" server --stdio` through ssh, which
/// begins in the home directory. Failing to write it only costs that.
fn put_down_starter(endpoint: &Path, binary: &Path) {
    let Ok(home) = home_of(endpoint) else {
        return;
    };
    let directory = home.join("bin");
    let (name, content) = starter(binary);
    let written = std::fs::create_dir_all(&directory)
        .and_then(|_| std::fs::write(directory.join(name), content));
    #[cfg(unix)]
    let written = written.and_then(|_| {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(directory.join(name), std::fs::Permissions::from_mode(0o755))
    });
    if let Err(error) = written {
        log::warn!(target: "host", "could not write the starter: {error}");
    }
}

#[cfg(windows)]
fn starter(binary: &Path) -> (&'static str, String) {
    ("cogno.cmd", format!("@\"{}\" %*\r\n", binary.display()))
}

#[cfg(not(windows))]
fn starter(binary: &Path) -> (&'static str, String) {
    // Single quotes keep every character of the path but the quote itself.
    let quoted = binary.display().to_string().replace('\'', "'\\''");
    ("cogno", format!("#!/bin/sh\nexec '{quoted}' \"$@\"\n"))
}

/// Starts the daemon so that it outlives this app.
fn start(binary: &Path) -> Result<(), String> {
    let mut command = Command::new(binary);
    command
        .arg("daemon")
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
            let (name, content) = starter(Path::new(r"C:\Users\me\.cogno\host\1\cogno.exe"));
            assert_eq!(name, "cogno.cmd");
            assert_eq!(
                content,
                "@\"C:\\Users\\me\\.cogno\\host\\1\\cogno.exe\" %*\r\n"
            );
        }
        #[cfg(not(windows))]
        {
            let (name, content) = starter(Path::new("/opt/it's here/cogno"));
            assert_eq!(name, "cogno");
            assert_eq!(
                content,
                "#!/bin/sh\nexec '/opt/it'\\''s here/cogno' \"$@\"\n"
            );
        }
    }
}
