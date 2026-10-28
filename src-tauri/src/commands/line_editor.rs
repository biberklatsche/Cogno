use std::collections::HashMap;
use std::io::Write;

/// Per-session transport for native line-editor actions of POSIX shells.
/// zsh reads a FIFO through a `zle -F` fd-watcher; bash has no fd hook, so it
/// gets a payload file plus a trigger byte sequence injected into the PTY
/// that fires a `bind -x` handler reading that file.
#[derive(Clone)]
pub(super) enum LineEditorChannel {
    // Only constructed on unix (see create_line_editor_channel).
    #[cfg_attr(not(unix), allow(dead_code))]
    Fifo(std::path::PathBuf),
    TriggerFile(std::path::PathBuf),
}

impl LineEditorChannel {
    fn path(&self) -> &std::path::Path {
        match self {
            LineEditorChannel::Fifo(path) => path,
            LineEditorChannel::TriggerFile(path) => path,
        }
    }
}

/// Byte sequence bound to the bash line-editor handler (`bind -x`). A
/// private CSI-style sequence no terminal emits and no user can type.
pub(super) const LINE_EDITOR_TRIGGER: &[u8] = b"\x1b[5005~";

/// Removes a session's line-editor channel directory (a private per-session
/// temp dir holding only the FIFO or payload file). Idempotent, so racing
/// removal paths are harmless.
pub(super) fn remove_line_editor_channel(channel: &Option<LineEditorChannel>) {
    if let Some(channel) = channel {
        if let Some(dir) = channel.path().parent() {
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}

#[cfg(windows)]
pub(super) fn write_shell_action_to_pipe(
    pipe_name: &str,
    action: &str,
    payload_json: Option<&str>,
) -> Result<(), String> {
    let pipe_path = format!(r"\\.\pipe\{}", pipe_name);
    let mut pipe = std::fs::OpenOptions::new()
        .write(true)
        .open(&pipe_path)
        .map_err(|e| format!("Failed to open line editor pipe {}: {}", pipe_path, e))?;

    let message = serde_json::json!({
        "action": action,
        "payload": payload_json
            .and_then(|payload| serde_json::from_str::<serde_json::Value>(payload).ok())
            .unwrap_or(serde_json::Value::Null),
    })
    .to_string();

    pipe.write_all(message.as_bytes())
        .map_err(|e| format!("Failed to write shell action to {}: {}", pipe_path, e))?;
    pipe.write_all(b"\n")
        .map_err(|e| format!("Failed to terminate shell action on {}: {}", pipe_path, e))?;
    pipe.flush()
        .map_err(|e| format!("Failed to flush line editor pipe {}: {}", pipe_path, e))?;

    Ok(())
}

#[cfg(not(windows))]
pub(super) fn write_shell_action_to_pipe(
    _pipe_name: &str,
    _action: &str,
    _payload_json: Option<&str>,
) -> Result<(), String> {
    Err("Shell actions via pipe are currently only supported on Windows".to_string())
}

/// Creates the per-session transport backing the native line-editor channel
/// of POSIX shells: a FIFO for zsh (read via `zle -F`), a payload file for
/// bash (read by the `bind -x` trigger handler). Returns None when the shell
/// has no such channel or creation fails - the integration script then finds
/// no COGNO_LINE_EDITOR_PIPE/COGNO_LINE_EDITOR_FILE, reports no native
/// actions in the capability handshake, and the app stays on the raw
/// fallback.
pub(super) fn create_line_editor_channel(
    shell_type: &str,
    env: &HashMap<String, String>,
) -> Option<LineEditorChannel> {
    // Without integration no script would ever read the channel.
    if !env.contains_key("COGNO_INTEGRATION_ROOT") {
        return None;
    }
    let session_id = env.get("COGNO_SESSION_ID")?;

    let wants_fifo = shell_type == "ZSH";
    let wants_trigger_file = shell_type == "Bash";
    if !wants_fifo && !wants_trigger_file {
        return None;
    }
    if wants_fifo && cfg!(not(unix)) {
        return None;
    }

    // Command lines can contain secrets: private per-session directory.
    let dir = std::env::temp_dir().join(format!("cogno-{}", session_id));
    if let Err(e) = std::fs::create_dir_all(&dir) {
        log::warn!(target: "pty", "failed to create line editor dir: {}", e);
        return None;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)) {
            log::warn!(target: "pty", "failed to restrict line editor dir: {}", e);
            return None;
        }
    }

    let path = dir.join("line-editor");
    if wants_trigger_file {
        // The payload file itself is (re)written atomically per request.
        return Some(LineEditorChannel::TriggerFile(path));
    }

    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
        if unsafe { libc::mkfifo(c_path.as_ptr(), 0o600) } != 0 {
            log::warn!(
                target: "pty",
                "failed to create line editor fifo: {}",
                std::io::Error::last_os_error()
            );
            let _ = std::fs::remove_dir(&dir);
            return None;
        }
        Some(LineEditorChannel::Fifo(path))
    }
    #[cfg(not(unix))]
    None
}

/// The action is the first field of a `;`-separated line the shell reads;
/// a name with `;`, a line break or anything but a plain word would split it.
pub(super) fn is_line_editor_action_name(action: &str) -> bool {
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
pub(super) fn build_line_editor_message(
    action: &str,
    payload_json: Option<&str>,
) -> (String, bool) {
    let payload = payload_json
        .and_then(|payload| serde_json::from_str::<serde_json::Value>(payload).ok())
        .unwrap_or(serde_json::Value::Null);
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

#[cfg(unix)]
pub(super) fn write_message_to_fifo(
    fifo_path: &std::path::Path,
    message: &str,
) -> Result<(), String> {
    use std::os::unix::fs::OpenOptionsExt;

    // O_NONBLOCK makes the open fail with ENXIO instead of blocking forever
    // when the shell never opened its read end (integration failed to load).
    // The shell keeps the FIFO open read-write for the whole session, so a
    // healthy session always has a reader.
    let mut fifo = std::fs::OpenOptions::new()
        .write(true)
        .custom_flags(libc::O_NONBLOCK)
        .open(fifo_path)
        .map_err(|e| {
            format!(
                "Failed to open line editor fifo {}: {}",
                fifo_path.display(),
                e
            )
        })?;

    fifo.write_all(message.as_bytes()).map_err(|e| {
        format!(
            "Failed to write shell action to {}: {}",
            fifo_path.display(),
            e
        )
    })
}

#[cfg(not(unix))]
pub(super) fn write_message_to_fifo(
    _fifo_path: &std::path::Path,
    _message: &str,
) -> Result<(), String> {
    Err("Shell actions via fifo are only supported on Unix".to_string())
}

/// Replaces the payload file atomically (write to a sibling temp file, then
/// rename), so the `bind -x` handler triggered right afterwards can never
/// observe a partial write.
pub(super) fn write_message_to_trigger_file(
    path: &std::path::Path,
    message: &str,
) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, message.as_bytes())
        .map_err(|e| format!("Failed to write line editor file {}: {}", path.display(), e))?;
    std::fs::rename(&tmp_path, path).map_err(|e| {
        format!(
            "Failed to publish line editor file {}: {}",
            path.display(),
            e
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_editor_action_names_are_plain_words() {
        assert!(is_line_editor_action_name("replaceCurrentInput"));
        assert!(is_line_editor_action_name("clear-line_2"));
        for bad in [
            "",
            "replace;rm -rf ~",
            "a
b",
            "a b",
            "ä",
        ] {
            assert!(!is_line_editor_action_name(bad), "{bad:?}");
        }
    }
}
