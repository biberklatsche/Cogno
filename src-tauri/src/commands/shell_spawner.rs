use crate::app_identity::{DEVELOPMENT_HOME_DIRECTORY_NAME, HOME_DIRECTORY_NAME};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

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
        let dir_name = if dev_mode {
            DEVELOPMENT_HOME_DIRECTORY_NAME
        } else {
            HOME_DIRECTORY_NAME
        };
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
        // The user's rc files load unless the profile opts out. The PATH baseline
        // comes from the prefetched login environment either way.
        let load_user_rc = profile.load_user_rc.unwrap_or(true);
        let working_dir = profile
            .working_dir
            .clone()
            .unwrap_or_else(|| "~".to_string());

        // Build argv based on integration settings
        let argv = if enable_integration {
            // Integration mode: filter incompatible args and add integration-specific args
            let mut args = profile.args.clone().unwrap_or_default();

            // For Bash: remove incompatible flags
            // -l/--login conflicts with --rcfile
            // -i is redundant as --rcfile implies interactive mode
            if profile.shell_type == "Bash" {
                args.retain(|arg| arg != "-l" && arg != "--login" && arg != "-i");
            }

            args.extend(self.get_integration_args(&profile.shell_type)?);
            args
        } else {
            // No integration: the profile's args as they are. There is no bootstrap
            // script to honour `load_user_rc`, so the shell's own flag does it.
            let mut args = profile.args.clone().unwrap_or_default();
            if !load_user_rc {
                prepend_skip_user_rc_args(&profile.shell_type, &mut args);
            }
            args
        };

        // Build environment
        let cogno_paths = self.get_cogno_paths();
        let cogno_executable_path = self.get_cogno_executable_path();
        let log_dir = self.integration_root.join("logs");

        // Bounded wait: prefetch usually finished long ago; if the user's rc
        // files are slow or hang, spawn without the login baseline instead of
        // blocking the terminal.
        let login_environment =
            super::login_environment::get_login_environment(std::time::Duration::from_secs(2));

        let env_builder = EnvironmentBuilder::new(
            self.integration_root.clone(),
            log_dir,
            load_user_rc,
            enable_integration,
        )
        .with_login_environment(
            login_environment.path,
            super::login_environment::fallback_lang(),
        )
        .with_path_injection(inject_cogno_cli, cogno_paths, &profile.shell_type)
        .with_shell_specific_env(&profile.shell_type, &working_dir, enable_integration);

        let merged_custom_env = profile.env.clone().unwrap_or_default();
        let env_builder = env_builder.with_custom_env(merged_custom_env);

        let mut shell_env = env_builder.build();

        if inject_cogno_cli {
            if let Some(executable_path) = cogno_executable_path {
                shell_env.env.insert(
                    "COGNO_CLI_PATH".to_string(),
                    executable_path.to_string_lossy().to_string(),
                );
            }
        }

        log::debug!(
            target: "shell_spawner",
            "shell spawn type={} path={}",
            profile.shell_type, shell_path
        );
        log::debug!(target: "shell_spawner", "shell spawn args={:?}", argv);

        Ok((shell_path, argv, shell_env.env, working_dir))
    }

    fn get_integration_args(&self, shell_type: &str) -> Result<Vec<String>, String> {
        match shell_type {
            "Bash" => {
                let rcfile = self.integration_root.join("bash").join("bootstrap.bash");
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
            "PowerShell" => {
                let integration_script = self.integration_root.join("pwsh").join("bootstrap.ps1");
                Ok(vec![
                    "-NoExit".to_string(),
                    "-NoProfile".to_string(),
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
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

        paths
    }

    fn get_cogno_executable_path(&self) -> Option<PathBuf> {
        std::env::current_exe().ok()
    }
}

/// The flags that make a shell skip the user's startup files. They go first:
/// Bash only accepts its long options ahead of the single-character ones.
fn prepend_skip_user_rc_args(shell_type: &str, args: &mut Vec<String>) {
    let flags: &[&str] = match shell_type {
        "Bash" => &["--noprofile", "--norc"],
        "ZSH" => &["-f"],
        "PowerShell" => &["-NoProfile"],
        _ => &[],
    };
    for flag in flags.iter().rev() {
        if !args.iter().any(|arg| arg.eq_ignore_ascii_case(flag)) {
            args.insert(0, flag.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(shell_type: &str, integration: bool, load_user_rc: Option<bool>) -> ShellProfile {
        ShellProfile {
            shell_type: shell_type.to_string(),
            path: Some("/bin/sh".to_string()),
            args: Some(vec!["-l".to_string(), "-i".to_string()]),
            env: None,
            working_dir: None,
            enable_shell_integration: Some(integration),
            inject_cogno_cli: Some(false),
            load_user_rc,
        }
    }

    fn spawn(profile: &ShellProfile) -> (Vec<String>, HashMap<String, String>) {
        let spawner = ShellSpawner {
            integration_root: PathBuf::from("/tmp/cogno-test-integration"),
        };
        let (_, argv, env, _) = spawner.prepare_spawn(profile).expect("spawn is prepared");
        (argv, env)
    }

    #[test]
    fn user_rc_loads_by_default() {
        let (_, env) = spawn(&profile("ZSH", true, None));
        assert_eq!(
            env.get("COGNO_ALLOW_USER_RC").map(String::as_str),
            Some("1")
        );
    }

    #[test]
    fn integration_honours_load_user_rc_false() {
        let (_, env) = spawn(&profile("ZSH", true, Some(false)));
        assert_eq!(
            env.get("COGNO_ALLOW_USER_RC").map(String::as_str),
            Some("0")
        );
    }

    #[test]
    fn without_integration_the_shell_flag_skips_the_rc_files() {
        let (bash, _) = spawn(&profile("Bash", false, Some(false)));
        assert_eq!(bash, ["--noprofile", "--norc", "-l", "-i"]);

        let (zsh, _) = spawn(&profile("ZSH", false, Some(false)));
        assert_eq!(zsh, ["-f", "-l", "-i"]);
    }

    #[test]
    fn without_integration_the_args_stay_untouched_when_rc_loads() {
        let (argv, _) = spawn(&profile("Bash", false, Some(true)));
        assert_eq!(argv, ["-l", "-i"]);
    }

    #[test]
    fn skip_flags_are_not_duplicated() {
        let mut args = vec!["-noprofile".to_string(), "-NoLogo".to_string()];
        prepend_skip_user_rc_args("PowerShell", &mut args);
        assert_eq!(args, ["-noprofile", "-NoLogo"]);
    }
}
