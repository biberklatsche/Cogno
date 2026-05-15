use std::process::Command;

#[tauri::command]
pub fn git_read_blob(git_root: String, rev: String) -> String {
    let output = Command::new("git")
        .current_dir(&git_root)
        .args(["show", &rev])
        .output();

    match output {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).into_owned(),
        _ => String::new(),
    }
}
