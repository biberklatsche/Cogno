use crate::app_identity::{DEVELOPMENT_HOME_DIRECTORY_NAME, HOME_DIRECTORY_NAME, LOG_FILE_STEM};
use std::path::PathBuf;

/// The Cogno home's name under the user's home: `.cogno`, or `.cogno-dev` in
/// development.
pub fn home_dir_name(dev_mode: bool) -> &'static str {
    if dev_mode {
        DEVELOPMENT_HOME_DIRECTORY_NAME
    } else {
        HOME_DIRECTORY_NAME
    }
}

/// The Cogno home directory for the active mode.
pub fn cogno_home(dev_mode: bool) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(home_dir_name(dev_mode)))
}

/// Returns the Cogno home directory path based on the active mode.
#[tauri::command]
pub fn get_cogno_home_dir(dev_mode: bool) -> Result<String, String> {
    Ok(cogno_home(dev_mode)?.display().to_string())
}

/// Where the agent hook scripts are (ARCHITECTURE.md 3.2): what an adapter
/// writes into an agent's config as the hook command.
#[tauri::command]
pub fn get_agent_hook_script_paths(
    dev_mode: bool,
) -> Result<crate::agent_hooks::AgentHookScriptPaths, String> {
    Ok(crate::agent_hooks::script_paths(&cogno_home(dev_mode)?))
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
    let log_file = log_dir.join(format!("{LOG_FILE_STEM}.log"));
    Ok(log_file.display().to_string())
}

#[tauri::command]
pub fn get_cli_config_set_overrides() -> Result<Option<String>, String> {
    Ok(std::env::var("COGNO_CONFIG_SET_OVERRIDES").ok())
}
