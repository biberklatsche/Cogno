//! The starter: a small file at a fixed place in the Cogno home that runs
//! this Cogno's binary, whatever the install directory. Hooks and plugins
//! reach Cogno by it (ARCHITECTURE.md 3.2).

use std::path::{Path, PathBuf};

/// The directory of the starter in the Cogno home.
const STARTER_DIRECTORY: &str = "bin";
/// The starter's name (on Windows with `.cmd`).
const STARTER_NAME: &str = "cogno";
#[cfg(not(windows))]
const APPIMAGE: &str = "APPIMAGE";

/// The binary the starter runs: this one.
fn binary() -> std::io::Result<PathBuf> {
    // An AppImage runs from a mount that goes when the app ends, under
    // another path each start: the starter takes the AppImage file itself.
    #[cfg(not(windows))]
    if let Some(appimage) = std::env::var_os(APPIMAGE).filter(|path| !path.is_empty()) {
        return Ok(PathBuf::from(appimage));
    }
    std::env::current_exe()
}

/// Puts the starter of this binary down in the Cogno home `home`. Failing to
/// write it only costs what runs it.
pub fn put_down(home: &Path) {
    let path = starter_path(home);
    let written = binary().and_then(|binary| {
        std::fs::create_dir_all(home.join(STARTER_DIRECTORY))?;
        std::fs::write(&path, starter(&binary))
    });
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_starter_runs_the_binary_with_what_it_was_given() {
        #[cfg(windows)]
        {
            let content = starter(Path::new(r"C:\Program Files\Cogno\cogno.exe"));
            assert_eq!(content, "@\"C:\\Program Files\\Cogno\\cogno.exe\" %*\r\n");
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
