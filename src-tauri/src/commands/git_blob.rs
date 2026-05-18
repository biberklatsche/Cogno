use std::process::Command;

#[tauri::command]
pub async fn git_read_blob(git_root: String, rev: String) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("git")
            .current_dir(&git_root)
            .args(["show", &rev])
            .output();

        match output {
            Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).into_owned(),
            _ => String::new(),
        }
    })
    .await
    .unwrap_or_default()
}
