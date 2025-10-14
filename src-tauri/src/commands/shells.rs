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
        use std::path::Path;
        use which::which;
        use winreg::enums::*;
        use winreg::RegKey;

        let known_shells = [
            ("PowerShell", "powershell.exe", "PowerShell"),
            ("PowerShell Core", "pwsh.exe", "PowerShell"),
            ("WSL", "wsl.exe", "Bash"),
        ];

        for (name, binary, shell_type) in known_shells {
            if let Ok(path) = which(binary) {
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: path.display().to_string(),
                    shell_type: shell_type
                });
            }
        }

        // Git Bash aus Registry
        let git_paths = [
            "SOFTWARE\\GitForWindows",
            "SOFTWARE\\WOW6432Node\\GitForWindows",
        ];

        for key_path in git_paths {
            if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(key_path) {
                let install_path_result: Result<String, std::io::Error> =
                    key.get_value("InstallPath");
                if let Ok(install_path) = install_path_result {
                    let bash_path = format!("{}\\bin\\bash.exe", install_path);
                    if Path::new(&bash_path).exists() {
                        shells.push(ShellInfo {
                            name: "Git Bash".to_string(),
                            path: bash_path,
                            shell_type: "GitBash"
                        });
                    }
                }
            }
        }
    }

    #[cfg(unix)]
    {
        use std::fs::read_to_string;
        use std::path::Path;

        // Liefert "Bash" oder "ZSH" (genau so geschrieben), sonst None
            fn detect_shell_label(path: &str) -> Option<&'static str> {
                let fname = Path::new(path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();

                // exakte Namen zuerst
                if fname == "bash" { return Some("Bash"); }
                if fname == "zsh"  { return Some("ZSH"); }

                // optional: toleranter für Varianten wie bash5, zsh-5.9
                if fname.contains("bash") { return Some("Bash"); }
                if fname.contains("zsh")  { return Some("ZSH"); }

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
                            shell_type: label.to_string(), // "Bash" oder "ZSH"
                        });
                    }
                }
            }
    }


    shells
}
