use std::io;

/// Reads the bundled default_settings.config file and returns its content as a String.
/// The file is embedded at compile time using include_str! macro.
pub fn read_default_settings() -> io::Result<String> {
    let content = include_str!("./settings_default.config");
    Ok(content.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_default_settings() {
        let result = read_default_settings();
        assert!(result.is_ok());
        
        let content = result.unwrap();
        assert!(!content.is_empty());
        assert!(content.contains("general.enable_telemetry"));
        assert!(content.contains("general.scrollback_lines"));
    }
}
