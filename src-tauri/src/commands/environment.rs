#[tauri::command]
pub fn get_exe_path() -> Result<String, String> {
    let p = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(p.display().to_string())
}

#[tauri::command]
pub fn get_exe_dir() -> Result<String, String> {
    let p = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = p.parent().ok_or("no parent dir")?;
    Ok(dir.display().to_string())
}

// Optional: Auf macOS den .app-Bundle-Root zurückgeben
#[tauri::command]
pub fn get_macos_app_bundle() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::path::Path;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        // .../MyApp.app/Contents/MacOS/MyApp  ->  .../MyApp.app
        if let Some(mac_os) = exe.parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
        {
            if mac_os.extension().and_then(|e| e.to_str()) == Some("app") {
                return Ok(Some(mac_os.display().to_string()));
            }
        }
        Ok(None)
    }
    #[cfg(not(target_os = "macos"))]
    { Ok(None) }
}