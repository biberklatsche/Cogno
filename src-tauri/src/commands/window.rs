use std::time::{SystemTime, UNIX_EPOCH};
use tauri::window::Color;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

use super::window_registry::WindowRegistry;

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
        .background_color(Color(0x0e, 0x19, 0x25, 0xff))
        .visible(false);

    #[cfg(target_os = "macos")]
    let win_builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);

    #[cfg(not(target_os = "macos"))]
    let win_builder = builder.decorations(false);

    let window = win_builder.build().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}

/// Claim a workspace for this window. If another window already holds it, that
/// window is focused instead and the claim fails with its label, so a
/// workspace is only ever open in one window.
#[tauri::command]
pub fn window_claim_workspace(
    window: tauri::WebviewWindow,
    registry: State<'_, WindowRegistry>,
    workspace_id: String,
) -> Result<(), String> {
    match registry.claim_workspace(&workspace_id, window.label()) {
        Ok(()) => Ok(()),
        Err(holder) => {
            if let Some(other) = window.app_handle().get_webview_window(&holder) {
                let _ = other.show();
                let _ = other.unminimize();
                let _ = other.set_focus();
            }
            Err(holder)
        }
    }
}

/// Release a workspace this window holds.
#[tauri::command]
pub fn window_release_workspace(
    window: tauri::WebviewWindow,
    registry: State<'_, WindowRegistry>,
    workspace_id: String,
) {
    registry.release_workspace(&workspace_id, window.label());
}
