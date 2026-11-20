//! Where a shell's start-up log goes: the bootstrap scripts write one file per
//! shell to `COGNO_LOG_DIR` when it is set. That is for tracing a start that
//! goes wrong, so it is set at debug level only (`COGNO_LOG_LEVEL=debug`), and
//! points into the app's log folder, next to the app log, not the Cogno home.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Manager};

const FOLDER: &str = "shell-bootstrap";
/// Older start-up logs are removed: they pile up, one per shell.
const KEEP_FOR: Duration = Duration::from_secs(7 * 24 * 60 * 60);

/// The folder for the shells' start-up logs, worked out once at start; none
/// unless logging at debug level.
pub struct ShellBootstrapLogDir(pub Option<PathBuf>);

/// Called once at start, after the logger is set up: picks the folder, and
/// clears the old logs in it in the background.
pub fn manage(app: &AppHandle) {
    let dir = (log::max_level() >= log::LevelFilter::Debug)
        .then(|| app.path().app_log_dir().ok())
        .flatten()
        .map(|log_dir| log_dir.join(FOLDER))
        .filter(|dir| std::fs::create_dir_all(dir).is_ok());
    if let Some(dir) = dir.clone() {
        std::thread::spawn(move || clear_old(&dir, SystemTime::now()));
    }
    app.manage(ShellBootstrapLogDir(dir));
}

/// Removes the files in `dir` last written more than `KEEP_FOR` before `now`.
fn clear_old(dir: &Path, now: SystemTime) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let written = entry.metadata().and_then(|metadata| metadata.modified());
        let too_old = written
            .ok()
            .and_then(|written| now.duration_since(written).ok())
            .is_some_and(|age| age > KEEP_FOR);
        if too_old {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_only_logs_older_than_the_limit() {
        let dir =
            std::env::temp_dir().join(format!("cogno-bootstrap-logs-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("shell-bootstrap-a.log"), "start").unwrap();

        clear_old(&dir, SystemTime::now());
        assert!(dir.join("shell-bootstrap-a.log").exists());

        // A week and a day from now, the file just written counts as old.
        clear_old(
            &dir,
            SystemTime::now() + KEEP_FOR + Duration::from_secs(24 * 60 * 60),
        );
        assert!(!dir.join("shell-bootstrap-a.log").exists());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
