// src/shells.rs

use serde::Serialize;

#[derive(Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
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
            ("CMD", "cmd.exe"),
            ("PowerShell", "powershell.exe"),
            ("PowerShell Core", "pwsh.exe"),
            ("WSL", "wsl.exe"),
        ];

        for (name, binary) in known_shells {
            if let Ok(path) = which(binary) {
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: path.display().to_string(),
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
                let install_path_result: Result<String, std::io::Error> = key.get_value("InstallPath");
                if let Ok(install_path) = install_path_result {
                    let bash_path = format!("{}\\bin\\bash.exe", install_path);
                    if Path::new(&bash_path).exists() {
                        shells.push(ShellInfo {
                            name: "Git Bash".to_string(),
                            path: bash_path,
                        });
                    }
                }
            }
        }
    }

    #[cfg(unix)]
    {
        use std::fs::read_to_string;

        if let Ok(content) = read_to_string("/etc/shells") {
            for line in content.lines() {
                let line = line.trim();
                if !line.starts_with('#') && line.starts_with('/') {
                    if let Some(name) = line.split('/').last() {
                        shells.push(ShellInfo {
                            name: name.to_string(),
                            path: line.to_string(),
                        });
                    }
                }
            }
        }
    }

    shells
}
