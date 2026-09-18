use crate::app_identity::TERM_PROGRAM_NAME;
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ShellEnvironment {
    pub env: HashMap<String, String>,
}

pub struct EnvironmentBuilder {
    env: HashMap<String, String>,
    integration_root: PathBuf,
    session_id: String,
}

impl EnvironmentBuilder {
    pub fn new(
        integration_root: PathBuf,
        log_dir: PathBuf,
        load_user_rc: bool,
        enable_integration: bool,
    ) -> Self {
        let session_id = Uuid::new_v4().to_string();

        let mut env = HashMap::new();

        // Mandatory environment variables
        env.insert("COGNO".to_string(), "1".to_string());
        env.insert("TERM".to_string(), "xterm-256color".to_string());
        env.insert("TERM_PROGRAM".to_string(), TERM_PROGRAM_NAME.to_string());
        env.insert("COGNO_SESSION_ID".to_string(), session_id.clone());

        if enable_integration {
            env.insert(
                "COGNO_INTEGRATION_ROOT".to_string(),
                integration_root.to_string_lossy().to_string(),
            );
            env.insert(
                "COGNO_LINE_EDITOR_PIPE_NAME".to_string(),
                format!("cogno-line-editor-{}", session_id.replace('-', "")),
            );
            env.insert(
                "COGNO_LOG_DIR".to_string(),
                log_dir.to_string_lossy().to_string(),
            );
            env.insert(
                "COGNO_ALLOW_USER_RC".to_string(),
                if load_user_rc { "1" } else { "0" }.to_string(),
            );
        }

        Self {
            env,
            integration_root,
            session_id,
        }
    }

    /// Applies the environment captured from the user's real login shell.
    ///
    /// The login PATH is exported as COGNO_LOGIN_PATH so bootstrap scripts can
    /// merge it as a baseline. When shell integration is disabled there is no
    /// bootstrap script, so the login PATH directly replaces the (minimal)
    /// GUI-process PATH the child would otherwise inherit.
    ///
    /// `lang` is the UTF-8 fallback for an app process without a locale; it is
    /// `None` when the process already has one to inherit.
    pub fn with_login_environment(
        mut self,
        login_path: Option<String>,
        lang: Option<String>,
    ) -> Self {
        if let Some(path) = login_path {
            self.env
                .insert("COGNO_LOGIN_PATH".to_string(), path.clone());

            let has_integration = self.env.contains_key("COGNO_INTEGRATION_ROOT");
            if !has_integration {
                self.env.insert("PATH".to_string(), path);
            }
        }

        if let Some(lang) = lang {
            self.env.insert("LANG".to_string(), lang);
        }

        self
    }

    pub fn with_path_injection(
        mut self,
        inject_path: bool,
        cogno_paths: Vec<PathBuf>,
        shell_type: &str,
    ) -> Self {
        if inject_path && !cogno_paths.is_empty() {
            let separator = if cfg!(windows) && shell_type == "PowerShell" {
                ";"
            } else {
                ":"
            };

            let path_prefix = cogno_paths
                .iter()
                .map(|p| Self::format_path_for_shell(p, shell_type))
                .collect::<Vec<_>>()
                .join(separator);

            self.env
                .insert("COGNO_PATH_PREFIX".to_string(), path_prefix.clone());

            // Only set PATH directly when shell integration is disabled.
            // With integration enabled, bootstrap scripts apply COGNO_PATH_PREFIX.
            // Setting both would prepend the same prefix twice.
            let has_integration = self.env.contains_key("COGNO_INTEGRATION_ROOT");
            let should_set_path_directly =
                !has_integration || (cfg!(windows) && shell_type == "PowerShell");

            if should_set_path_directly {
                // Prefer the PATH already staged by with_login_environment
                // (the login-shell baseline) over the GUI process PATH, which
                // is minimal when the app was launched by launchd/systemd.
                let base_path = self
                    .env
                    .get("PATH")
                    .cloned()
                    .or_else(|| std::env::var("PATH").ok());

                if let Some(base_path) = base_path {
                    let new_path = format!("{}{}{}", path_prefix, separator, base_path);
                    self.env.insert("PATH".to_string(), new_path);
                }
            }
        }

        self
    }

    fn format_path_for_shell(path: &PathBuf, _shell_type: &str) -> String {
        path.to_string_lossy().to_string()
    }

    pub fn with_shell_specific_env(
        mut self,
        shell_type: &str,
        working_dir: &str,
        enable_integration: bool,
    ) -> Self {
        if enable_integration {
            match shell_type {
                "Bash" => {
                    // Note: BASH_ENV is not used for interactive shells with --rcfile
                    // We keep it for compatibility but shells are started with --rcfile in shell_spawner
                }
                "ZSH" => {
                    // ZSH looks for .zshrc in ZDOTDIR
                    // Point ZDOTDIR to our zsh directory
                    let zsh_dir = self.integration_root.join("zsh");
                    self.env
                        .insert("ZDOTDIR".to_string(), zsh_dir.to_string_lossy().to_string());
                }
                _ => {}
            }
        }

        // Set working directory in env for reference
        self.env
            .insert("COGNO_WORKING_DIR".to_string(), working_dir.to_string());

        self
    }

    pub fn with_custom_env(mut self, custom_env: HashMap<String, String>) -> Self {
        for (key, value) in custom_env {
            self.env.insert(key, value);
        }
        self
    }

    pub fn build(self) -> ShellEnvironment {
        ShellEnvironment { env: self.env }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn builder() -> EnvironmentBuilder {
        EnvironmentBuilder::new(PathBuf::from("/root"), PathBuf::from("/logs"), true, true)
    }

    #[test]
    fn fallback_lang_is_set_without_login_path() {
        let env = builder()
            .with_login_environment(None, Some("de_DE.UTF-8".to_string()))
            .build()
            .env;
        assert_eq!(env.get("LANG").map(String::as_str), Some("de_DE.UTF-8"));
    }

    #[test]
    fn lang_is_left_to_the_process_when_no_fallback_is_needed() {
        let env = builder()
            .with_login_environment(Some("/usr/bin".to_string()), None)
            .build()
            .env;
        assert!(!env.contains_key("LANG"));
    }

    #[test]
    fn profile_env_overrides_fallback_lang() {
        let custom = HashMap::from([("LANG".to_string(), "fr_FR.UTF-8".to_string())]);
        let env = builder()
            .with_login_environment(None, Some("de_DE.UTF-8".to_string()))
            .with_custom_env(custom)
            .build()
            .env;
        assert_eq!(env.get("LANG").map(String::as_str), Some("fr_FR.UTF-8"));
    }
}
