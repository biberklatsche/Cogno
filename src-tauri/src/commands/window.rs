use tauri::{WebviewUrl, WebviewWindowBuilder};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub async fn new_window(app: tauri::AppHandle) -> Result<(), String> {
    // Generate a unique label for the new window
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let label = format!("win-{}", millis);

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::default())
        .title("")
        .inner_size(800.0, 600.0)
        .visible(false);

    #[cfg(target_os = "macos")]
    let win_builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);

    #[cfg(not(target_os = "macos"))]
    let win_builder = builder.decorations(false);

    let window = win_builder.build().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}
