use base64::{engine::general_purpose, Engine as _};
use uuid::Uuid;

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

    let filename = format!("cogno_paste_{}.{}", Uuid::new_v4().simple(), ext);
    let path = std::env::temp_dir().join(filename);

    std::fs::write(&path, &data)
        .map_err(|e| format!("Failed to write image to temp file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
