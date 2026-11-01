use base64::{engine::general_purpose, Engine as _};
use std::path::Path;
use uuid::Uuid;

/// A dev build and a release build share the temp dir, and each removes
/// its leftovers on start: the prefix tells their files apart, so a dev
/// instance never takes the pasted images of the release instance running
/// beside it (the path has been handed to the shell by then).
const PASTE_FILE_PREFIX: &str = if cfg!(debug_assertions) {
    "cogno-dev_paste_"
} else {
    "cogno_paste_"
};

#[tauri::command]
pub async fn save_clipboard_image_to_file(
    base64_data: String,
    extension: String,
) -> Result<String, String> {
    let data = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode image data: {}", e))?;

    let ext = match extension.as_str() {
        "jpeg" | "jpg" => "jpg",
        _ => "png",
    };

    let filename = format!("{}{}.{}", PASTE_FILE_PREFIX, Uuid::new_v4().simple(), ext);
    let path = std::env::temp_dir().join(filename);

    std::fs::write(&path, &data)
        .map_err(|e| format!("Failed to write image to temp file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

/// Pasted images live until Cogno exits; the next start removes what is left.
/// Single instance per build, so no running Cogno of this build still needs
/// them; the other build's files are its own to remove.
pub fn remove_leftover_paste_files() {
    remove_paste_files_in(&std::env::temp_dir());
}

fn remove_paste_files_in(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if entry
            .file_name()
            .to_string_lossy()
            .starts_with(PASTE_FILE_PREFIX)
        {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// What the other build names its files.
    const OTHER_BUILDS_PREFIX: &str = if cfg!(debug_assertions) {
        "cogno_paste_"
    } else {
        "cogno-dev_paste_"
    };

    #[test]
    fn removes_only_this_builds_paste_files() {
        let dir = std::env::temp_dir().join(format!("cogno-paste-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let own = dir.join(format!("{PASTE_FILE_PREFIX}abc.png"));
        let other_builds = dir.join(format!("{OTHER_BUILDS_PREFIX}abc.png"));
        std::fs::write(&own, b"x").unwrap();
        std::fs::write(&other_builds, b"x").unwrap();
        std::fs::write(dir.join("other.png"), b"x").unwrap();

        remove_paste_files_in(&dir);

        assert!(!own.exists());
        assert!(other_builds.exists());
        assert!(dir.join("other.png").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
