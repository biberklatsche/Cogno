use crate::app_identity::{DEVELOPMENT_HOME_DIRECTORY_NAME, HOME_DIRECTORY_NAME};
use std::path::PathBuf;

#[tauri::command]
pub fn get_exe_dir() -> Result<String, String> {
    let p = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = p.parent().ok_or("no parent dir")?;
    Ok(dir.display().to_string())
}

/// Returns the Cogno home directory path based on the active mode.
#[tauri::command]
pub fn get_cogno_home_dir(dev_mode: bool) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let dir_name = if dev_mode {
        DEVELOPMENT_HOME_DIRECTORY_NAME
    } else {
        HOME_DIRECTORY_NAME
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

/// Returns the path to the application log file.
#[tauri::command]
pub fn get_cogno_log_file_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let log_dir = app_handle.path().app_log_dir().map_err(|e| e.to_string())?;
    let log_file = log_dir.join("cogno.log");
    Ok(log_file.display().to_string())
}

#[tauri::command]
pub fn get_cli_config_set_overrides() -> Result<Option<String>, String> {
    Ok(std::env::var("COGNO_CONFIG_SET_OVERRIDES").ok())
}
