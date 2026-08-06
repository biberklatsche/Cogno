use std::sync::{Condvar, Mutex, Once};
use std::time::Duration;

/// Environment values captured from the user's real login shell.
///
/// GUI processes on macOS (and some Linux setups) are started by launchd/systemd
/// with a minimal environment. The values captured here serve as a baseline so
/// spawned terminals see the same PATH/locale as the user's normal terminal,
/// even when shell integration or rc replay is unavailable.
#[derive(Debug, Clone, Default)]
pub struct LoginEnvironment {
    pub path: Option<String>,
    pub lang: Option<String>,
}

static LOGIN_ENVIRONMENT: Mutex<Option<LoginEnvironment>> = Mutex::new(None);
static LOGIN_ENVIRONMENT_READY: Condvar = Condvar::new();
static DETECTION_STARTED: Once = Once::new();

/// Starts detection on a background thread so the first shell spawn does not
/// pay the login-shell startup cost. Safe to call multiple times.
pub fn prefetch_login_environment() {
    DETECTION_STARTED.call_once(|| {
        std::thread::spawn(|| {
            let environment = detect_login_environment();
            log::info!(
                target: "login_environment",
                "login environment detected path_present={} lang={:?}",
                environment.path.is_some(),
                environment.lang
            );
            let mut slot = LOGIN_ENVIRONMENT
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            *slot = Some(environment);
            LOGIN_ENVIRONMENT_READY.notify_all();
        });
    });
}

/// Returns the captured login environment, waiting at most `max_wait` for the
/// background detection to finish. Falls back to an empty environment so a
/// slow or hanging login shell can never block a terminal spawn for long;
/// later spawns pick up the detected values once available.
pub fn get_login_environment(max_wait: Duration) -> LoginEnvironment {
    prefetch_login_environment();

    let slot = LOGIN_ENVIRONMENT
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let (slot, _) = LOGIN_ENVIRONMENT_READY
        .wait_timeout_while(slot, max_wait, |value| value.is_none())
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    slot.clone().unwrap_or_default()
}

#[cfg(windows)]
fn detect_login_environment() -> LoginEnvironment {
    // Windows GUI processes inherit the user's registry PATH; no login shell
    // replay is needed there.
    LoginEnvironment::default()
}

#[cfg(unix)]
fn detect_login_environment() -> LoginEnvironment {
    LoginEnvironment {
        path: detect_login_path(),
        lang: detect_lang(),
    }
}

#[cfg(unix)]
const PATH_MARKER_BEGIN: &str = "COGNO_LOGIN_PATH_BEGIN>";
#[cfg(unix)]
const PATH_MARKER_END: &str = "<COGNO_LOGIN_PATH_END";

#[cfg(unix)]
fn detect_login_path() -> Option<String> {
    let shell = login_shell_executable();

    // Interactive login first: version managers like nvm often only initialize
    // in interactive shells. Fall back to a plain login shell if that fails.
    for flags in [&["-l", "-i", "-c"][..], &["-l", "-c"][..]] {
        match run_shell_for_path(&shell, flags) {
            Some(path) => return Some(path),
            None => log::warn!(
                target: "login_environment",
                "login PATH capture failed shell={} flags={:?}",
                shell,
                flags
            ),
        }
    }
    None
}

#[cfg(unix)]
fn login_shell_executable() -> String {
    let fallback = if cfg!(target_os = "macos") {
        "/bin/zsh"
    } else {
        "/bin/bash"
    };

    std::env::var("SHELL")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && std::path::Path::new(s).exists())
        .unwrap_or_else(|| fallback.to_string())
}

#[cfg(unix)]
fn path_capture_command(shell: &str) -> String {
    let shell_name = std::path::Path::new(shell)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(shell);

    if shell_name == "fish" {
        // In fish, "$PATH" inside quotes joins the list with spaces.
        format!(
            "printf '%s%s%s' '{}' (string join : $PATH) '{}'",
            PATH_MARKER_BEGIN, PATH_MARKER_END
        )
    } else {
        format!(
            "printf '%s%s%s' '{}' \"$PATH\" '{}'",
            PATH_MARKER_BEGIN, PATH_MARKER_END
        )
    }
}

#[cfg(unix)]
fn run_shell_for_path(shell: &str, flags: &[&str]) -> Option<String> {
    use std::io::Read;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    const TIMEOUT: Duration = Duration::from_secs(5);

    let mut child = Command::new(shell)
        .args(flags)
        .arg(path_capture_command(shell))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    // Drain stdout on a separate thread so a chatty rc file cannot fill the
    // pipe buffer and deadlock the child.
    let mut stdout = child.stdout.take()?;
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buffer = String::new();
        let _ = stdout.read_to_string(&mut buffer);
        let _ = sender.send(buffer);
    });

    let deadline = Instant::now() + TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(_) => return None,
        }
    }

    let output = receiver.recv_timeout(Duration::from_secs(1)).ok()?;
    parse_marked_path(&output)
}

/// Extracts the PATH between the markers. Uses the last BEGIN marker so noise
/// printed by rc files before or around the payload is ignored.
#[cfg(unix)]
fn parse_marked_path(output: &str) -> Option<String> {
    let start = output.rfind(PATH_MARKER_BEGIN)? + PATH_MARKER_BEGIN.len();
    let end = output[start..].find(PATH_MARKER_END)? + start;
    let path = output[start..end].trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

/// macOS GUI processes have no LANG which breaks UTF-8 rendering in many TUI
/// programs. Derive it from the system locale like Terminal.app does.
#[cfg(target_os = "macos")]
fn detect_lang() -> Option<String> {
    if let Ok(lang) = std::env::var("LANG") {
        if !lang.trim().is_empty() {
            return None;
        }
    }

    use std::process::Command;
    let locale = Command::new("/usr/bin/defaults")
        .args(["read", "-g", "AppleLocale"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let locale = match locale {
        Some(value) => {
            // "de_DE@currency=EUR" -> "de_DE"
            let base = value.split('@').next().unwrap_or(&value).to_string();
            if base
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
                && !base.is_empty()
            {
                base.replace('-', "_")
            } else {
                "en_US".to_string()
            }
        }
        None => "en_US".to_string(),
    };

    Some(format!("{}.UTF-8", locale))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn detect_lang() -> Option<String> {
    // Linux desktop sessions provide LANG themselves.
    None
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn parses_path_between_markers() {
        let output = format!(
            "rc noise\n{}/opt/homebrew/bin:/usr/bin{}\n",
            PATH_MARKER_BEGIN, PATH_MARKER_END
        );
        assert_eq!(
            parse_marked_path(&output),
            Some("/opt/homebrew/bin:/usr/bin".to_string())
        );
    }

    #[test]
    fn uses_last_begin_marker_when_rc_echoes_markers() {
        let output = format!(
            "echoed {b} fake\n{b}/real/path{e}",
            b = PATH_MARKER_BEGIN,
            e = PATH_MARKER_END
        );
        assert_eq!(parse_marked_path(&output), Some("/real/path".to_string()));
    }

    #[test]
    fn returns_none_without_markers() {
        assert_eq!(parse_marked_path("just noise"), None);
    }

    #[test]
    fn returns_none_for_empty_path() {
        let output = format!("{}{}", PATH_MARKER_BEGIN, PATH_MARKER_END);
        assert_eq!(parse_marked_path(&output), None);
    }

    #[test]
    fn captures_real_login_path() {
        // Runs the actual login shell; skipped implicitly if no shell exists.
        if let Some(path) = detect_login_path() {
            assert!(path.contains(':') || path.contains('/'));
        }
    }
}
