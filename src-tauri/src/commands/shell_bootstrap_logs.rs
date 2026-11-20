//! Where a shell's start-up log goes: the bootstrap scripts write one file per
//! shell to `COGNO_LOG_DIR` when it is set. That is for tracing a start that
//! goes wrong, so it is set at debug level only (`COGNO_LOG_LEVEL=debug`), and
//! points into the app's log folder, next to the app log, not the Cogno home.

use std::path::{Path, PathBuf};
use std::sync::Once;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Manager};

const FOLDER: &str = "shell-bootstrap";
/// Older start-up logs are removed: they pile up, one per shell.
const KEEP_FOR: Duration = Duration::from_secs(7 * 24 * 60 * 60);

static CLEAR_OLD: Once = Once::new();

/// The folder for the shells' start-up logs; none unless logging at debug level.
pub fn log_dir(app: &AppHandle) -> Option<PathBuf> {
    if log::max_level() < log::LevelFilter::Debug {
        return None;
    }
    let dir = app.path().app_log_dir().ok()?.join(FOLDER);
    std::fs::create_dir_all(&dir).ok()?;
    CLEAR_OLD.call_once(|| clear_older_than(&dir, KEEP_FOR, SystemTime::now()));
    Some(dir)
}

/// Removes the files in `dir` last written before `now - keep_for`.
fn clear_older_than(dir: &Path, keep_for: Duration, now: SystemTime) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let written = entry.metadata().and_then(|metadata| metadata.modified());
        let too_old = written
            .ok()
            .and_then(|written| now.duration_since(written).ok())
            .is_some_and(|age| age > keep_for);
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

        // A week and a day from now, the file just written counts as old.
        let later = SystemTime::now() + KEEP_FOR + Duration::from_secs(24 * 60 * 60);
        clear_older_than(&dir, KEEP_FOR, SystemTime::now());
        assert!(dir.join("shell-bootstrap-a.log").exists());

        clear_older_than(&dir, KEEP_FOR, later);
        assert!(!dir.join("shell-bootstrap-a.log").exists());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
