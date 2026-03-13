use crate::app_identity::get_app_identity;
use std::path::PathBuf;

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
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        // .../MyApp.app/Contents/MacOS/MyApp  ->  .../MyApp.app
        if let Some(mac_os) = exe
            .parent()
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
    {
        Ok(None)
    }
}

/// Returns the cogno home directory path (.cogno or .cogno-dev based on dev_mode)
#[tauri::command]
pub fn get_cogno_home_dir(dev_mode: bool) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let app_identity = get_app_identity();
    let dir_name = if dev_mode {
        app_identity.development_home_directory_name
    } else {
        app_identity.home_directory_name
    };
    let cogno_home = home.join(dir_name);
    Ok(cogno_home.display().to_string())
}

/// Returns the cogno config file path
#[tauri::command]
pub fn get_cogno_config_file_path(dev_mode: bool) -> Result<String, String> {
    if let Ok(config_path_override) = std::env::var("COGNO_CONFIG_PATH") {
        let trimmed_path = config_path_override.trim();
        if !trimmed_path.is_empty() {
            return Ok(trimmed_path.to_string());
        }
    }

    let cogno_home = get_cogno_home_dir(dev_mode)?;
    let config_path = PathBuf::from(cogno_home).join("cogno.config");
    Ok(config_path.display().to_string())
}

/// Returns the cogno database file path
#[tauri::command]
pub fn get_cogno_db_file_path(dev_mode: bool) -> Result<String, String> {
    let cogno_home = get_cogno_home_dir(dev_mode)?;
    let db_path = PathBuf::from(cogno_home).join("cogno.db");
    Ok(db_path.display().to_string())
}

#[tauri::command]
pub fn get_system_path() -> Result<Option<String>, String> {
    Ok(std::env::var("PATH").ok())
}

#[tauri::command]
pub fn get_cli_config_set_overrides() -> Result<Option<String>, String> {
    Ok(std::env::var("COGNO_CONFIG_SET_OVERRIDES").ok())
}
