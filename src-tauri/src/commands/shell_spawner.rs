use std::collections::HashMap;
use std::path::PathBuf;
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
    pub inject_path: Option<bool>,
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
        let inject_path = profile.inject_path.unwrap_or(true);
        let load_user_rc = profile.load_user_rc.unwrap_or(false);
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
        )
        .with_path_injection(inject_path, cogno_paths)
        .with_shell_specific_env(&profile.shell_type, &working_dir);

        let env_builder = if let Some(custom_env) = &profile.env {
            env_builder.with_custom_env(custom_env.clone())
        } else {
            env_builder
        };

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
                // --rcfile requires the file path to exist
                Ok(vec![
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

        // Add Cogno bin directory if it exists
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                paths.push(exe_dir.to_path_buf());
            }
        }

        // Add other Cogno tool paths here as needed
        // For example: ~/.cogno2/bin

        paths
    }
}
