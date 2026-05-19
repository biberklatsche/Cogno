use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn git_read_blob(git_root: String, rev: String) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new("git");
        command.current_dir(&git_root).args(["show", &rev]);

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);

        let output = command.output();

        match output {
            Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).into_owned(),
            _ => String::new(),
        }
    })
    .await
    .unwrap_or_default()
}
