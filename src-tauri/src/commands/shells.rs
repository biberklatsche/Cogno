// src/shells.rs

use serde::Serialize;

#[derive(Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
    pub shell_type: String,
}

#[tauri::command]
pub fn list_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(windows)]
    {
        use std::collections::HashSet;
        use std::path::Path;
        use which::which;

        let known_shells = [
            (
                "PowerShell",
                "powershell.exe",
                "PowerShell",
                [r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"].as_slice(),
            ),
            (
                "PowerShell Core",
                "pwsh.exe",
                "PowerShell",
                [
                    r"C:\Program Files\PowerShell\7\pwsh.exe",
                    r"C:\Program Files\PowerShell\6\pwsh.exe",
                ]
                .as_slice(),
            ),
            //("WSL", "wsl.exe", "Bash"),
        ];

        let mut seen_paths = HashSet::new();
        let mut add_shell = |name: &str, path: &str, shell_type: &str| {
            let normalized_path = path.to_ascii_lowercase();
            if seen_paths.insert(normalized_path) {
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: path.to_string(),
                    shell_type: shell_type.to_string(),
                });
            }
        };

        for (name, binary, shell_type, fallback_paths) in known_shells {
            if let Ok(path) = which(binary) {
                let rendered_path = path.display().to_string();
                add_shell(name, &rendered_path, shell_type);
            }

            for fallback_path in fallback_paths {
                if Path::new(fallback_path).exists() {
                    add_shell(name, fallback_path, shell_type);
                }
            }
        }
    }

    #[cfg(unix)]
    {
        use std::fs::read_to_string;
        use std::path::Path;

        // Returns "Bash" or "ZSH" (exactly as written), otherwise None
        fn detect_shell_label(path: &str) -> Option<&'static str> {
            let fname = Path::new(path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();

            // exact names first
            if fname == "bash" {
                return Some("Bash");
            }
            if fname == "zsh" {
                return Some("ZSH");
            }

            // optional: more tolerant for variants like bash5, zsh-5.9
            if fname.contains("bash") {
                return Some("Bash");
            }
            if fname.contains("zsh") {
                return Some("ZSH");
            }

            None
        }

        if let Ok(content) = read_to_string("/etc/shells") {
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') || !line.starts_with('/') {
                    continue;
                }

                if let Some(label) = detect_shell_label(line) {
                    let name = Path::new(line)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or(line)
                        .to_string();

                    shells.push(ShellInfo {
                        name,
                        path: line.to_string(),
                        shell_type: label.to_string(), // "Bash" or "ZSH"
                    });
                }
            }
        }
    }
    shells
}
