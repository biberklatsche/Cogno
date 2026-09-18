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
}

static LOGIN_ENVIRONMENT: Mutex<Option<LoginEnvironment>> = Mutex::new(None);
static LOGIN_ENVIRONMENT_READY: Condvar = Condvar::new();
static DETECTION_STARTED: Once = Once::new();

/// Starts detection on a background thread so the first shell spawn does not
/// pay the login-shell startup cost. Safe to call multiple times.
pub fn prefetch_login_environment() {
    DETECTION_STARTED.call_once(|| {
        std::thread::spawn(|| {
            // Cheap; warmed first so it never waits on the login shell.
            fallback_lang();
            let environment = detect_login_environment();
            log::info!(
                target: "login_environment",
                "login environment detected path_present={}",
                environment.path.is_some()
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

/// UTF-8 locale for spawned shells when the app process has none.
///
/// macOS GUI processes start without LANG, and a Linux app launched outside a
/// desktop session can too. Without a UTF-8 locale TUI programs misrender and
/// `pbcopy` reads piped UTF-8 as MacRoman ("grün" -> "gr√ºn"). Resolved
/// independently of the login PATH capture so a slow login shell can never
/// leave a terminal without it.
pub fn fallback_lang() -> Option<String> {
    static FALLBACK_LANG: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
    FALLBACK_LANG
        .get_or_init(|| {
            let lang = if process_has_locale(|name| std::env::var(name).ok()) {
                None
            } else {
                detect_lang()
            };
            log::info!(target: "login_environment", "fallback lang={:?}", lang);
            lang
        })
        .clone()
}

fn process_has_locale(get_env: impl Fn(&str) -> Option<String>) -> bool {
    ["LC_ALL", "LC_CTYPE", "LANG"]
        .iter()
        .any(|name| get_env(name).is_some_and(|value| !value.trim().is_empty()))
}

/// Derive LANG from the system locale like Terminal.app does.
#[cfg(target_os = "macos")]
fn detect_lang() -> Option<String> {
    use std::process::Command;
    let apple_locale = Command::new("/usr/bin/defaults")
        .args(["read", "-g", "AppleLocale"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok());

    Some(lang_from_apple_locale(apple_locale.as_deref(), |lang| {
        std::path::Path::new("/usr/share/locale")
            .join(lang)
            .is_dir()
    }))
}

/// Language and region are independent settings on macOS, so AppleLocale can
/// be a combination like "en_DE" that has no locale definition. Such a LANG
/// silently degrades to the C locale, hence the existence check.
#[cfg(any(target_os = "macos", test))]
fn lang_from_apple_locale(
    apple_locale: Option<&str>,
    locale_exists: impl Fn(&str) -> bool,
) -> String {
    const DEFAULT_LANG: &str = "en_US.UTF-8";

    // "de_DE@currency=EUR" -> "de_DE"
    let base = apple_locale
        .and_then(|value| value.trim().split('@').next())
        .unwrap_or_default()
        .replace('-', "_");
    if base.is_empty() || !base.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return DEFAULT_LANG.to_string();
    }

    let lang = format!("{}.UTF-8", base);
    if locale_exists(&lang) {
        lang
    } else {
        DEFAULT_LANG.to_string()
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn detect_lang() -> Option<String> {
    // Desktop sessions provide LANG themselves; this only covers launches
    // with a bare environment.
    Some("C.UTF-8".to_string())
}

#[cfg(windows)]
fn detect_lang() -> Option<String> {
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

    #[test]
    fn detects_locale_from_any_locale_variable() {
        let only = |name: &'static str, value: &'static str| {
            move |key: &str| (key == name).then(|| value.to_string())
        };
        assert!(process_has_locale(only("LANG", "de_DE.UTF-8")));
        assert!(process_has_locale(only("LC_CTYPE", "UTF-8")));
        assert!(process_has_locale(only("LC_ALL", "C")));
        assert!(!process_has_locale(only("LANG", "  ")));
        assert!(!process_has_locale(|_| None));
    }

    #[test]
    fn derives_lang_from_apple_locale() {
        let exists = |lang: &str| lang == "de_DE.UTF-8";
        assert_eq!(
            lang_from_apple_locale(Some("de_DE\n"), exists),
            "de_DE.UTF-8"
        );
        assert_eq!(
            lang_from_apple_locale(Some("de-DE@currency=EUR"), exists),
            "de_DE.UTF-8"
        );
    }

    #[test]
    fn falls_back_when_apple_locale_has_no_locale_definition() {
        let exists = |lang: &str| lang == "de_DE.UTF-8";
        assert_eq!(lang_from_apple_locale(Some("en_DE"), exists), "en_US.UTF-8");
        assert_eq!(
            lang_from_apple_locale(Some("../etc"), exists),
            "en_US.UTF-8"
        );
        assert_eq!(lang_from_apple_locale(Some(""), exists), "en_US.UTF-8");
        assert_eq!(lang_from_apple_locale(None, exists), "en_US.UTF-8");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn detected_lang_is_an_installed_utf8_locale() {
        let lang = detect_lang().expect("macOS always yields a lang");
        assert!(lang.ends_with(".UTF-8"));
        assert!(std::path::Path::new("/usr/share/locale")
            .join(&lang)
            .is_dir());
    }
}
