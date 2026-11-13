//! Native line editor actions: Cogno replaces what is typed at the prompt
//! through the shell's own line editor instead of typing keys into it.
//!
//! Each shell takes them its own way. PowerShell reads a named pipe (Windows
//! only). zsh reads a FIFO through a `zle -F` fd-watcher. bash has no fd hook,
//! so it gets a payload file plus a trigger byte sequence typed into the PTY
//! that fires a `bind -x` handler reading that file.

use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::env_vars;
use crate::protocol::{HostError, HostErrorCode, ShellType};
use crate::shell_process::ShellInput;

/// Byte sequence bound to the bash line-editor handler (`bind -x`). A
/// private CSI-style sequence no terminal emits and no user can type.
const LINE_EDITOR_TRIGGER: &[u8] = b"\x1b[5005~";
/// What submits the edited line, typed into the PTY after the action.
const ENTER: u8 = b'\r';
/// The file or FIFO in a session's private channel directory.
const CHANNEL_FILE_NAME: &str = "line-editor";

/// Where a session's shell takes line editor actions.
#[derive(Clone)]
pub(crate) enum LineEditorTarget {
    /// PowerShell: the named pipe its integration listens on.
    #[cfg(windows)]
    Pipe(String),
    /// zsh: a FIFO its integration watches.
    #[cfg(unix)]
    Fifo(PathBuf),
    /// bash: a file its `bind -x` handler reads when triggered.
    TriggerFile(PathBuf),
}

impl LineEditorTarget {
    /// The target of a shell about to start with `env`. None when the shell
    /// takes no actions or setting the target up failed: the integration
    /// script then reports no native actions in its capability handshake and
    /// the app stays on typing keys.
    pub fn for_shell(shell_type: ShellType, env: &HashMap<String, String>) -> Option<Self> {
        // Without integration no script would ever read the target.
        if !env.contains_key(env_vars::COGNO_INTEGRATION_ROOT) {
            return None;
        }
        match shell_type {
            #[cfg(windows)]
            ShellType::PowerShell => env
                .get(env_vars::COGNO_LINE_EDITOR_PIPE_NAME)
                .cloned()
                .map(LineEditorTarget::Pipe),
            #[cfg(unix)]
            ShellType::Zsh => create_fifo(&private_directory(env)?).map(LineEditorTarget::Fifo),
            // The pipe is a Windows thing, the FIFO a Unix one.
            #[cfg(not(windows))]
            ShellType::PowerShell => None,
            #[cfg(not(unix))]
            ShellType::Zsh => None,
            ShellType::Bash => {
                // The payload file itself is (re)written atomically per action.
                Some(LineEditorTarget::TriggerFile(
                    private_directory(env)?.join(CHANNEL_FILE_NAME),
                ))
            }
        }
    }

    /// What the shell's environment needs to find the target, if anything
    /// beyond what the environment already holds.
    pub fn env(&self) -> Option<(&'static str, &Path)> {
        match self {
            #[cfg(windows)]
            LineEditorTarget::Pipe(_) => None,
            #[cfg(unix)]
            LineEditorTarget::Fifo(path) => Some((env_vars::COGNO_LINE_EDITOR_PIPE, path)),
            LineEditorTarget::TriggerFile(path) => Some((env_vars::COGNO_LINE_EDITOR_FILE, path)),
        }
    }

    /// Carries out `action`. Writing to the pipe or FIFO can block until the
    /// shell gets to it: never call this while holding a lock.
    pub fn execute(
        &self,
        action: &str,
        payload_json: Option<&str>,
        input: &ShellInput,
    ) -> Result<(), HostError> {
        if !is_line_editor_action_name(action) {
            return Err(HostError::new(
                HostErrorCode::InvalidRequest,
                format!("Not a line editor action: {action:?}"),
            ));
        }
        let mut pty_input: Vec<u8> = Vec::new();
        let auto_execute = match self {
            #[cfg(windows)]
            LineEditorTarget::Pipe(pipe_name) => {
                return write_to_pipe(pipe_name, action, payload_json)
            }
            #[cfg(unix)]
            LineEditorTarget::Fifo(path) => {
                let (message, auto_execute) = build_line_editor_message(action, payload_json);
                write_to_fifo(path, &message)?;
                auto_execute
            }
            LineEditorTarget::TriggerFile(path) => {
                let (message, auto_execute) = build_line_editor_message(action, payload_json);
                write_to_trigger_file(path, &message)?;
                // The payload is on disk; the trigger makes the shell's
                // `bind -x` handler pick it up.
                pty_input.extend_from_slice(LINE_EDITOR_TRIGGER);
                auto_execute
            }
        };
        // The shell-side handlers cannot submit (accept-line is a no-op inside a
        // `zle -F` widget, and readline has no accept from `bind -x`), so
        // autoExecute is done here: an Enter through the PTY, after the action.
        // ZLE services fd handlers before pending keyboard bytes (and readline
        // processes the trigger sequence strictly before the Enter), so it
        // always accepts the freshly replaced buffer, never the old one.
        if auto_execute {
            pty_input.push(ENTER);
        }
        if pty_input.is_empty() {
            return Ok(());
        }
        input.queue(pty_input)
    }

    /// Removes the session's private channel directory. Idempotent, so racing
    /// removals are harmless.
    pub fn remove(&self) {
        let path = match self {
            #[cfg(windows)]
            LineEditorTarget::Pipe(_) => return,
            #[cfg(unix)]
            LineEditorTarget::Fifo(path) => path,
            LineEditorTarget::TriggerFile(path) => path,
        };
        if let Some(directory) = path.parent() {
            let _ = std::fs::remove_dir_all(directory);
        }
    }
}

/// A private directory of the session, for what its channel needs: command
/// lines can contain secrets.
fn private_directory(env: &HashMap<String, String>) -> Option<PathBuf> {
    let session_id = env.get(env_vars::COGNO_SESSION_ID)?;
    let directory = std::env::temp_dir().join(format!("cogno-{session_id}"));
    if let Err(error) = std::fs::create_dir_all(&directory) {
        log::warn!(target: "pty", "failed to create line editor dir: {error}");
        return None;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(error) =
            std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700))
        {
            log::warn!(target: "pty", "failed to restrict line editor dir: {error}");
            return None;
        }
    }
    Some(directory)
}

#[cfg(unix)]
fn create_fifo(directory: &Path) -> Option<PathBuf> {
    use std::os::unix::ffi::OsStrExt;
    let path = directory.join(CHANNEL_FILE_NAME);
    let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
    // SAFETY: `c_path` is a NUL-terminated path that lives across the call.
    if unsafe { libc::mkfifo(c_path.as_ptr(), 0o600) } != 0 {
        log::warn!(
            target: "pty",
            "failed to create line editor fifo: {}",
            std::io::Error::last_os_error()
        );
        let _ = std::fs::remove_dir(directory);
        return None;
    }
    Some(path)
}

/// The action is the first field of a `;`-separated line the shell reads;
/// a name with `;`, a line break or anything but a plain word would split it.
fn is_line_editor_action_name(action: &str) -> bool {
    !action.is_empty()
        && action
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Builds the line-format message the shell handlers consume with
/// `IFS=';' read -r action cursor autoexec text`: the text is the last
/// field, so it may contain unescaped semicolons; only backslash, CR and LF
/// are escaped (decoded shell-side via ${(g::)...} in zsh, printf %b in
/// bash). Returns the message and whether the request asks for autoExecute.
fn build_line_editor_message(action: &str, payload_json: Option<&str>) -> (String, bool) {
    let payload = parse_payload(payload_json);
    let text = payload
        .get("text")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let cursor_index = payload
        .get("cursorIndex")
        .and_then(|value| value.as_i64())
        .unwrap_or(-1);
    let auto_execute = payload
        .get("autoExecute")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    let escaped_text = text
        .replace('\\', "\\\\")
        .replace('\r', "\\r")
        .replace('\n', "\\n");
    let message = format!(
        "{};{};{};{}\n",
        action,
        cursor_index,
        if auto_execute { "1" } else { "0" },
        escaped_text
    );
    (message, auto_execute)
}

fn parse_payload(payload_json: Option<&str>) -> serde_json::Value {
    payload_json
        .and_then(|payload| serde_json::from_str::<serde_json::Value>(payload).ok())
        .unwrap_or(serde_json::Value::Null)
}

#[cfg(windows)]
fn write_to_pipe(
    pipe_name: &str,
    action: &str,
    payload_json: Option<&str>,
) -> Result<(), HostError> {
    let pipe_path = format!(r"\\.\pipe\{pipe_name}");
    let failed =
        |error: std::io::Error| HostError::io(&format!("Line editor pipe {pipe_path}"), error);
    let mut pipe = std::fs::OpenOptions::new()
        .write(true)
        .open(&pipe_path)
        .map_err(failed)?;
    let message = serde_json::json!({
        "action": action,
        "payload": parse_payload(payload_json),
    })
    .to_string();
    pipe.write_all(message.as_bytes()).map_err(failed)?;
    pipe.write_all(b"\n").map_err(failed)?;
    pipe.flush().map_err(failed)
}

#[cfg(unix)]
fn write_to_fifo(fifo_path: &Path, message: &str) -> Result<(), HostError> {
    use std::os::unix::fs::OpenOptionsExt;

    let failed = |error: std::io::Error| {
        HostError::io(&format!("Line editor fifo {}", fifo_path.display()), error)
    };
    // O_NONBLOCK makes the open fail with ENXIO instead of blocking forever
    // when the shell never opened its read end (integration failed to load).
    // The shell keeps the FIFO open read-write for the whole session, so a
    // healthy session always has a reader.
    let mut fifo = std::fs::OpenOptions::new()
        .write(true)
        .custom_flags(libc::O_NONBLOCK)
        .open(fifo_path)
        .map_err(failed)?;
    fifo.write_all(message.as_bytes()).map_err(failed)
}

/// Replaces the payload file atomically (write to a sibling temp file, then
/// rename), so the `bind -x` handler triggered right afterwards can never
/// observe a partial write.
fn write_to_trigger_file(path: &Path, message: &str) -> Result<(), HostError> {
    let failed = |error: std::io::Error| {
        HostError::io(&format!("Line editor file {}", path.display()), error)
    };
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, message.as_bytes()).map_err(failed)?;
    std::fs::rename(&tmp_path, path).map_err(failed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_editor_action_names_are_plain_words() {
        assert!(is_line_editor_action_name("replaceCurrentInput"));
        assert!(is_line_editor_action_name("clear-line_2"));
        for bad in ["", "replace;rm -rf ~", "a\nb", "a b", "ä"] {
            assert!(!is_line_editor_action_name(bad), "{bad:?}");
        }
    }

    #[test]
    fn the_message_escapes_line_breaks_and_says_whether_to_submit() {
        let (message, auto_execute) = build_line_editor_message(
            "replaceCurrentInput",
            Some(r#"{"text":"a;b\nc\\d","cursorIndex":2,"autoExecute":true}"#),
        );
        assert_eq!(message, "replaceCurrentInput;2;1;a;b\\nc\\\\d\n");
        assert!(auto_execute);
    }

    #[test]
    fn a_shell_without_integration_takes_no_actions() {
        assert!(LineEditorTarget::for_shell(ShellType::Bash, &HashMap::new()).is_none());
    }
}
