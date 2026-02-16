use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};

use super::environment_builder::EnvironmentBuilder;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellProfile {
    pub shell_type: String,
    pub path: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub working_dir: Option<String>,
    pub enable_shell_integration: Option<bool>,
    #[serde(alias = "inject_path")]
    pub inject_cogno_cli: Option<bool>,
    pub load_user_rc: Option<bool>,
}

pub struct ShellSpawner {
    integration_root: PathBuf,
}

impl ShellSpawner {
    pub fn new(dev_mode: bool) -> Result<Self, String> {
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        let dir_name = if dev_mode { ".cogno2-dev" } else { ".cogno2" };
        let integration_root = home.join(dir_name).join("shell-integration");

        Ok(Self { integration_root })
    }

    pub fn prepare_spawn(
        &self,
        profile: &ShellProfile,
    ) -> Result<(String, Vec<String>, HashMap<String, String>, String), String> {
        let shell_path = profile
            .path
            .clone()
            .ok_or("Shell path not specified in profile")?;

        let enable_integration = profile.enable_shell_integration.unwrap_or(true);
        let inject_cogno_cli = profile.inject_cogno_cli.unwrap_or(true);
        // With shell integration enabled we rely on user rc files to reconstruct
        // the same PATH/toolchain environment as a normal interactive shell.
        let load_user_rc = if enable_integration {
            true
        } else {
            profile.load_user_rc.unwrap_or(false)
        };
        let working_dir = profile
            .working_dir
            .clone()
            .unwrap_or_else(|| "~".to_string());

        // Build argv based on shell type and integration settings
        let argv = if enable_integration {
            self.build_integration_argv(&profile.shell_type, &shell_path, &profile.args)?
        } else {
            // Use user-provided args or defaults
            profile.args.clone().unwrap_or_default()
        };

        // Build environment
        let cogno_paths = self.get_cogno_paths();
        let log_dir = self.integration_root.join("logs");

        let env_builder = EnvironmentBuilder::new(
            self.integration_root.clone(),
            log_dir,
            load_user_rc,
            enable_integration,
        )
        .with_path_injection(inject_cogno_cli, cogno_paths)
        .with_shell_specific_env(&profile.shell_type, &working_dir, enable_integration);

        let mut merged_custom_env = profile.env.clone().unwrap_or_default();
        if enable_integration
            && load_user_rc
            && !merged_custom_env.contains_key("COGNO_LOGIN_PATH")
        {
            if let Some(login_path) = self.detect_login_path(&profile.shell_type, &shell_path) {
                merged_custom_env.insert("COGNO_LOGIN_PATH".to_string(), login_path);
            }
        }

        let env_builder = env_builder.with_custom_env(merged_custom_env);

        let shell_env = env_builder.build();

        Ok((shell_path, argv, shell_env.env, working_dir))
    }

    fn build_integration_argv(
        &self,
        shell_type: &str,
        _shell_path: &str,
        user_args: &Option<Vec<String>>,
    ) -> Result<Vec<String>, String> {
        match shell_type {
            "Bash" | "GitBash" => {
                let rcfile = self.integration_root.join("bash").join("cogno.bashrc");

                // Use --rcfile to load our integration
                // Force interactive mode so readline keybindings (e.g. arrows) work.
                // --rcfile requires the file path to exist.
                Ok(vec![
                    "-i".to_string(),
                    "--rcfile".to_string(),
                    rcfile.to_string_lossy().to_string(),
                ])
            }
            "ZSH" => {
                // Zsh looks for .zshrc in ZDOTDIR (set in environment_builder)
                // Just start interactive shell, ZDOTDIR/.zshrc will be loaded automatically
                Ok(vec!["-i".to_string()])
            }
            "Fish" => {
                // XDG_CONFIG_HOME is set in environment
                // Use user-provided args or default to [-i]
                if let Some(args) = user_args {
                    Ok(args.clone())
                } else {
                    Ok(vec!["-i".to_string()])
                }
            }
            "PowerShell" => {
                let integration_script = self.integration_root.join("pwsh").join("integration.ps1");

                Ok(vec![
                    "-NoLogo".to_string(),
                    "-NoExit".to_string(),
                    "-NoProfile".to_string(),
                    "-Command".to_string(),
                    format!(". '{}'", integration_script.to_string_lossy()),
                ])
            }
            _ => Err(format!("Unsupported shell type: {}", shell_type)),
        }
    }

    fn get_cogno_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        // Add Cogno executable directory if it exists.
        // This is controlled by profile.inject_cogno_cli.
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                paths.push(exe_dir.to_path_buf());
            }
        }

        // Add other Cogno tool paths here as needed
        // For example: ~/.cogno2/bin

        paths
    }

    fn detect_login_path(&self, shell_type: &str, shell_path: &str) -> Option<String> {
        let args: Vec<&str> = match shell_type {
            "ZSH" => vec!["-l", "-c", "print -r -- $PATH"],
            "Bash" | "GitBash" => vec!["-l", "-c", "printf '%s' \"$PATH\""],
            _ => return None,
        };

        let output = Command::new(shell_path).args(args).output().ok()?;
        if !output.status.success() {
            return None;
        }

        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    }
}
