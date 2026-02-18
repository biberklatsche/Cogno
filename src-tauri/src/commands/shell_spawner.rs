use std::collections::HashMap;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
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

        // Build argv based on integration settings
        let argv = if enable_integration {
            // Integration mode: filter incompatible args and add integration-specific args
            let mut args = profile.args.clone().unwrap_or_default();

            // For Bash/GitBash: remove incompatible flags
            // -l/--login conflicts with --rcfile
            // -i is redundant as --rcfile implies interactive mode
            if matches!(profile.shell_type.as_str(), "Bash" | "GitBash") {
                args.retain(|arg| arg != "-l" && arg != "--login" && arg != "-i");
            }

            args.extend(self.get_integration_args(&profile.shell_type)?);
            args
        } else {
            // No integration: use profile args as-is
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

        let merged_custom_env = profile.env.clone().unwrap_or_default();
        let env_builder = env_builder.with_custom_env(merged_custom_env);

        let shell_env = env_builder.build();

        // Debug logging
        println!("Shell spawn - Type: {}, Path: {}", profile.shell_type, shell_path);
        println!("Shell spawn - Args: {:?}", argv);

        Ok((shell_path, argv, shell_env.env, working_dir))
    }

    fn get_integration_args(&self, shell_type: &str) -> Result<Vec<String>, String> {
        match shell_type {
            "Bash" | "GitBash" => {
                let rcfile = self.integration_root.join("bash").join("cogno.bashrc");
                // Add --rcfile to load our integration
                Ok(vec![
                    "--rcfile".to_string(),
                    rcfile.to_string_lossy().to_string(),
                ])
            }
            "ZSH" => {
                // ZDOTDIR is set in environment, .zshrc loaded automatically
                Ok(vec![])
            }
            "Fish" => {
                // XDG_CONFIG_HOME is set in environment
                Ok(vec![])
            }
            "PowerShell" => {
                let integration_script = self.integration_root.join("pwsh").join("integration.ps1");
                Ok(vec![
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

        if let Some(cogno_bin_dir) = self.get_cogno_bin_dir() {
            if let Err(error) = self.ensure_cogno_command_in_bin_dir(&cogno_bin_dir) {
                eprintln!("Failed to ensure cogno launcher: {}", error);
            }
            paths.push(cogno_bin_dir);
        }

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

    fn get_cogno_bin_dir(&self) -> Option<PathBuf> {
        self.integration_root
            .parent()
            .map(|cogno_home_dir| cogno_home_dir.join("bin"))
    }

    fn ensure_cogno_command_in_bin_dir(&self, cogno_bin_dir: &PathBuf) -> Result<(), String> {
        let executable_path = std::env::current_exe().map_err(|error| error.to_string())?;
        fs::create_dir_all(cogno_bin_dir).map_err(|error| error.to_string())?;

        #[cfg(windows)]
        {
            let launcher_path = cogno_bin_dir.join("cogno.cmd");
            let launcher_script = format!(
                "@echo off\r\n\"{}\" %*\r\n",
                executable_path.display()
            );
            fs::write(&launcher_path, launcher_script).map_err(|error| error.to_string())?;
            return Ok(());
        }

        #[cfg(not(windows))]
        {
            let launcher_path = cogno_bin_dir.join("cogno");
            let launcher_script = format!(
                "#!/usr/bin/env sh\n\"{}\" \"$@\"\n",
                executable_path.display()
            );
            fs::write(&launcher_path, launcher_script).map_err(|error| error.to_string())?;

            #[cfg(unix)]
            {
                let permissions = fs::Permissions::from_mode(0o755);
                fs::set_permissions(&launcher_path, permissions).map_err(|error| error.to_string())?;
            }

            return Ok(());
        }
    }

}
