use std::io;

/// Reads the bundled init script content for the given shell type.
/// Scripts are embedded at compile time using include_str! and selected by name.
pub fn read_script(shell_type: &str) -> io::Result<String> {
    let key = shell_type.trim().to_lowercase();

    let content: &str = match key.as_str() {
        // Map gitbash to bash script
        "gitbash" | "bash" => include_str!("../scripts/bash.sh"),
        "zsh" => include_str!("../scripts/zsh.sh"),
        // Windows PowerShell
        "powershell" => include_str!("../scripts/powershell.ps1"),
        _ => "",
    };

    Ok(content.to_string())
}

/// Tauri command to get the init script for a given shell type.
/// Accepted values: "PowerShell", "Bash", "GitBash", "ZSH" (case-insensitive).
#[tauri::command]
pub fn get_script(shell_type: String) -> Result<String, String> {
    read_script(&shell_type).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_scripts_non_empty_for_known_shells() {
        for (name, expect_non_empty) in [
            ("powershell", true),
            ("bash", true),
            ("gitbash", true),
            ("zsh", true),
            ("unknown", false),
        ] {
            let content = read_script(name).unwrap();
            assert_eq!(!content.is_empty(), expect_non_empty, "shell: {}", name);
        }
    }
}
