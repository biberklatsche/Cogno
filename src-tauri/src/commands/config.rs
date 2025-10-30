use std::io;

/// Internal function to read the bundled OS-specific default config file.
/// The file is embedded at compile time using include_str! macro.
/// The correct file is selected based on the target operating system.
pub fn read_default_config() -> io::Result<String> {
    #[cfg(target_os = "windows")]
    let content = include_str!("../default_windows.config");
    
    #[cfg(target_os = "linux")]
    let content = include_str!("../default_linux.config");
    
    #[cfg(target_os = "macos")]
    let content = include_str!("../default_macos.config");
    
    Ok(content.to_string())
}

/// Tauri command to read the bundled OS-specific default config.
/// Returns the content as a String or an error message.
#[tauri::command]
pub fn get_default_config() -> Result<String, String> {
    read_default_config().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_default_config() {
        let result = read_default_config();
        assert!(result.is_ok());
        
        let content = result.unwrap();
        assert!(!content.is_empty());
        assert!(content.contains("general.enable_telemetry"));
        assert!(content.contains("general.scrollback_lines"));
    }
}
