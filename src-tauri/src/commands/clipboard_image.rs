use base64::{engine::general_purpose, Engine as _};
use std::path::Path;
use uuid::Uuid;

const PASTE_FILE_PREFIX: &str = "cogno_paste_";

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
/// Single instance, so no running Cogno still needs them.
pub fn remove_leftover_paste_files() {
    remove_paste_files_in(&std::env::temp_dir());
}

fn remove_paste_files_in(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(PASTE_FILE_PREFIX) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_only_paste_files() {
        let dir = std::env::temp_dir().join(format!("cogno-paste-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("cogno_paste_abc.png"), b"x").unwrap();
        std::fs::write(dir.join("other.png"), b"x").unwrap();

        remove_paste_files_in(&dir);

        assert!(!dir.join("cogno_paste_abc.png").exists());
        assert!(dir.join("other.png").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
