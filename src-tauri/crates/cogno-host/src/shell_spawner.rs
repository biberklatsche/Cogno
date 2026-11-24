//! How a shell of a profile is started: its program, arguments, environment
//! and working directory, with Cogno's shell integration wired in.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::env_vars;
use crate::environment_builder::EnvironmentBuilder;
use crate::protocol::{HostError, HostErrorCode, ShellProfile, ShellType};

/// The directory under the Cogno home that holds the shell integration, one
/// directory per version of Cogno (`shell_integration`).
pub(crate) const INTEGRATION_DIRECTORY: &str = "shell-integration";
/// Where a shell starts when its profile names no directory.
const HOME_DIRECTORY: &str = "~";
/// How long a spawn waits for the user's login environment. It is usually
/// there long before; when the user's rc files are slow or hang, the shell
/// starts without that baseline instead of keeping the terminal waiting.
const LOGIN_ENVIRONMENT_PATIENCE: Duration = Duration::from_secs(2);

/// Where the shell integration of `version` lies in the Cogno home `home`:
/// each version has its own (`Request::InstallShellIntegration`).
pub(crate) fn integration_root(home: &Path, version: &str) -> PathBuf {
    home.join(INTEGRATION_DIRECTORY).join(version)
}

/// What a spawn starts.
pub struct PreparedSpawn {
    pub program: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub working_dir: String,
}

pub struct ShellSpawner {
    integration_root: PathBuf,
    /// Where the shell writes its start-up log; none unless the app that
    /// runs the host logs at debug level.
    bootstrap_log_dir: Option<PathBuf>,
}

impl ShellSpawner {
    pub fn new(integration_root: PathBuf, bootstrap_log_dir: Option<PathBuf>) -> Self {
        Self {
            integration_root,
            bootstrap_log_dir,
        }
    }

    pub fn prepare_spawn(&self, profile: &ShellProfile) -> Result<PreparedSpawn, HostError> {
        let program = profile.path.clone().ok_or_else(|| {
            HostError::new(
                HostErrorCode::SpawnFailed,
                "The shell profile names no program",
            )
        })?;

        let enable_integration = profile.enable_shell_integration.unwrap_or(true);
        let inject_cogno_cli = profile.inject_cogno_cli.unwrap_or(true);
        // The user's rc files load unless the profile opts out. The PATH baseline
        // comes from the prefetched login environment either way.
        let load_user_rc = profile.load_user_rc.unwrap_or(true);
        let working_dir = profile
            .working_dir
            .clone()
            .unwrap_or_else(|| HOME_DIRECTORY.to_string());

        let mut args = profile.args.clone().unwrap_or_default();
        if enable_integration {
            // Bash: -l/--login conflicts with --rcfile, and -i is implied by it.
            if profile.shell_type == ShellType::Bash {
                args.retain(|arg| arg != "-l" && arg != "--login" && arg != "-i");
            }
            args.extend(self.integration_args(profile.shell_type));
        } else if !load_user_rc {
            // No bootstrap script honours `load_user_rc`: the shell's own flag does.
            prepend_skip_user_rc_args(profile.shell_type, &mut args);
        }

        let cogno_executable = std::env::current_exe().ok();
        let cogno_paths: Vec<PathBuf> = cogno_executable
            .iter()
            .filter_map(|executable| executable.parent().map(Path::to_path_buf))
            .collect();
        let login_environment =
            crate::login_environment::get_login_environment(LOGIN_ENVIRONMENT_PATIENCE);

        let mut env = EnvironmentBuilder::new(
            self.integration_root.clone(),
            self.bootstrap_log_dir.as_deref(),
            load_user_rc,
            enable_integration,
        )
        .with_login_environment(
            login_environment.path,
            crate::login_environment::fallback_lang(),
        )
        .with_path_injection(inject_cogno_cli, cogno_paths, profile.shell_type)
        .with_shell_specific_env(profile.shell_type, &working_dir, enable_integration)
        .with_custom_env(profile.env.clone().unwrap_or_default())
        .build();

        if inject_cogno_cli {
            if let Some(executable) = cogno_executable {
                env.insert(
                    env_vars::COGNO_CLI_PATH.to_string(),
                    executable.to_string_lossy().to_string(),
                );
            }
        }

        log::debug!(
            target: "shell_spawner",
            "shell spawn type={} path={} args={:?}",
            profile.shell_type, program, args
        );
        Ok(PreparedSpawn {
            program,
            args,
            env,
            working_dir,
        })
    }

    fn integration_args(&self, shell_type: ShellType) -> Vec<String> {
        match shell_type {
            ShellType::Bash => {
                let rcfile = self.integration_root.join("bash").join("bootstrap.bash");
                vec!["--rcfile".to_string(), rcfile.to_string_lossy().to_string()]
            }
            // ZDOTDIR is set in the environment: its .zshrc loads by itself.
            ShellType::Zsh => Vec::new(),
            ShellType::PowerShell => {
                let integration_script = self.integration_root.join("pwsh").join("bootstrap.ps1");
                vec![
                    "-NoExit".to_string(),
                    "-NoProfile".to_string(),
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                    "-Command".to_string(),
                    format!(
                        ". {}",
                        powershell_single_quoted(&integration_script.to_string_lossy())
                    ),
                ]
            }
        }
    }
}

/// `value` as a PowerShell literal string. Inside one, a quote is escaped by
/// doubling it - and PowerShell takes the typographic single quotes for quotes
/// too, so a home folder like `C:\Users\O'Brien` still dot-sources the script.
fn powershell_single_quoted(value: &str) -> String {
    let mut quoted = String::with_capacity(value.len() + 2);
    quoted.push('\'');
    for character in value.chars() {
        if matches!(
            character,
            '\'' | '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}'
        ) {
            quoted.push(character);
        }
        quoted.push(character);
    }
    quoted.push('\'');
    quoted
}

/// The flags that make a shell skip the user's startup files. They go first:
/// Bash only accepts its long options ahead of the single-character ones.
fn prepend_skip_user_rc_args(shell_type: ShellType, args: &mut Vec<String>) {
    let flags: &[&str] = match shell_type {
        ShellType::Bash => &["--noprofile", "--norc"],
        ShellType::Zsh => &["-f"],
        ShellType::PowerShell => &["-NoProfile"],
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

    fn profile(
        shell_type: ShellType,
        integration: bool,
        load_user_rc: Option<bool>,
    ) -> ShellProfile {
        ShellProfile {
            shell_type,
            path: Some("/bin/sh".to_string()),
            args: Some(vec!["-l".to_string(), "-i".to_string()]),
            env: None,
            working_dir: None,
            enable_shell_integration: Some(integration),
            inject_cogno_cli: Some(false),
            load_user_rc,
        }
    }

    fn spawn(profile: &ShellProfile) -> PreparedSpawn {
        ShellSpawner::new(PathBuf::from("/tmp/cogno-test-integration"), None)
            .prepare_spawn(profile)
            .expect("spawn is prepared")
    }

    #[test]
    fn user_rc_loads_by_default() {
        let env = spawn(&profile(ShellType::Zsh, true, None)).env;
        assert_eq!(
            env.get(env_vars::COGNO_ALLOW_USER_RC).map(String::as_str),
            Some("1")
        );
    }

    #[test]
    fn integration_honours_load_user_rc_false() {
        let env = spawn(&profile(ShellType::Zsh, true, Some(false))).env;
        assert_eq!(
            env.get(env_vars::COGNO_ALLOW_USER_RC).map(String::as_str),
            Some("0")
        );
    }

    #[test]
    fn without_integration_the_shell_flag_skips_the_rc_files() {
        let bash = spawn(&profile(ShellType::Bash, false, Some(false))).args;
        assert_eq!(bash, ["--noprofile", "--norc", "-l", "-i"]);

        let zsh = spawn(&profile(ShellType::Zsh, false, Some(false))).args;
        assert_eq!(zsh, ["-f", "-l", "-i"]);
    }

    #[test]
    fn without_integration_the_args_stay_untouched_when_rc_loads() {
        let args = spawn(&profile(ShellType::Bash, false, Some(true))).args;
        assert_eq!(args, ["-l", "-i"]);
    }

    #[test]
    fn a_profile_without_a_program_is_refused_with_its_code() {
        let mut without_program = profile(ShellType::Bash, false, None);
        without_program.path = None;
        let refused = ShellSpawner::new(PathBuf::from("/tmp"), None)
            .prepare_spawn(&without_program)
            .err()
            .unwrap();
        assert_eq!(refused.code, HostErrorCode::SpawnFailed);
    }

    #[test]
    fn each_version_of_cogno_has_its_own_integration() {
        let home = Path::new("/home/me/.cogno");
        assert_ne!(
            integration_root(home, "0.5.0"),
            integration_root(home, "0.6.0")
        );
    }

    #[test]
    fn a_quote_in_the_integration_path_stays_inside_the_powershell_literal() {
        let args = ShellSpawner::new(PathBuf::from("/home/O'Brien/cogno"), None)
            .integration_args(ShellType::PowerShell);
        assert!(args
            .last()
            .expect("the -Command argument")
            .contains("O''Brien"));
        assert_eq!(
            powershell_single_quoted("a\u{2019}b"),
            "'a\u{2019}\u{2019}b'"
        );
    }

    #[test]
    fn skip_flags_are_not_duplicated() {
        let mut args = vec!["-noprofile".to_string(), "-NoLogo".to_string()];
        prepend_skip_user_rc_args(ShellType::PowerShell, &mut args);
        assert_eq!(args, ["-noprofile", "-NoLogo"]);
    }
}
