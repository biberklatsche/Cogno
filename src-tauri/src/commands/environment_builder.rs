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
        env.insert("TERM_PROGRAM".to_string(), "cogno2".to_string());
        env.insert("COGNO_SESSION_ID".to_string(), session_id.clone());

        if enable_integration {
            env.insert(
                "COGNO_INTEGRATION_ROOT".to_string(),
                integration_root.to_string_lossy().to_string(),
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

    pub fn with_path_injection(mut self, inject_path: bool, cogno_paths: Vec<PathBuf>) -> Self {
        if inject_path && !cogno_paths.is_empty() {
            let separator = if cfg!(windows) { ";" } else { ":" };

            let path_prefix = cogno_paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(separator);

            self.env
                .insert("COGNO_PATH_PREFIX".to_string(), path_prefix.clone());

            // Only set PATH directly when shell integration is disabled.
            // With integration enabled, bootstrap scripts apply COGNO_PATH_PREFIX.
            // Setting both would prepend the same prefix twice.
            if !self.env.contains_key("COGNO_INTEGRATION_ROOT") {
                if let Ok(system_path) = std::env::var("PATH") {
                    let new_path = format!("{}{}{}", path_prefix, separator, system_path);
                    self.env.insert("PATH".to_string(), new_path);
                }
            }
        }

        self
    }

    pub fn with_shell_specific_env(
        mut self,
        shell_type: &str,
        working_dir: &str,
        enable_integration: bool,
    ) -> Self {
        if enable_integration {
            match shell_type {
                "Bash" | "GitBash" => {
                    // Note: BASH_ENV is not used for interactive shells with --rcfile
                    // We keep it for compatibility but shells are started with --rcfile in shell_spawner
                }
                "ZSH" => {
                    // ZSH looks for .zshrc in ZDOTDIR
                    // Point ZDOTDIR to our zsh directory
                    let zsh_dir = self.integration_root.join("zsh");
                    self.env.insert(
                        "ZDOTDIR".to_string(),
                        zsh_dir.to_string_lossy().to_string(),
                    );
                }
                "Fish" => {
                    // Fish expects XDG_CONFIG_HOME/fish/config.fish
                    // So we point XDG_CONFIG_HOME to integration_root (contains fish/ subdirectory)
                    self.env.insert(
                        "XDG_CONFIG_HOME".to_string(),
                        self.integration_root.to_string_lossy().to_string(),
                    );
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
