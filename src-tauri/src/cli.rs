use clap::{ArgAction, Parser, Subcommand};

pub const COGNO_ACTION_NAMES: &[&str] = &[
    "copy",
    "paste",
    "cut",
    "new_tab",
    "close_tab",
    "select_next_tab",
    "select_previous_tab",
    "select_next_pane",
    "select_previous_pane",
    "split_right",
    "split_left",
    "split_down",
    "split_up",
    "maximize_pane",
    "minimize_pane",
    "close_terminal",
    "clear_buffer",
    "close_other_tabs",
    "close_all_tabs",
    "open_workspace",
    "open_command_palette",
    "open_terminal_search",
    "open_notification",
    "quit",
    "new_window",
    "close_window",
    "minimize_window",
    "open_config",
    "load_config",
    "cycle_completion_mode",
    "clear_line",
    "clear_line_to_end",
    "clear_line_to_start",
    "delete_previous_word",
    "delete_next_word",
    "go_to_next_word",
    "go_to_previous_word",
    "select_all",
    "select_text_right",
    "select_text_left",
    "select_word_right",
    "select_word_left",
    "select_text_to_end_of_line",
    "select_text_to_start_of_line",
];

#[derive(Parser, Debug, Clone)]
#[command(name = "cogno", version, about = "Cogno CLI")]
pub struct Cli {
    /// Use config file from a custom path for this process.
    #[arg(long, global = true, value_name = "path")]
    pub config: Option<String>,

    /// Override config values for this process only. Format: key=value
    #[arg(long = "set", global = true, action = ArgAction::Append, value_name = "k=v")]
    pub config_set_overrides: Vec<String>,

    /// Command to execute. Defaults to starting the app when omitted.
    #[command(subcommand)]
    pub command: Option<CliCommand>,
}

#[derive(Subcommand, Debug, Clone)]
pub enum CliCommand {
    /// Start Cogno (default command)
    Run,
    /// Work with action commands
    Action {
        #[command(subcommand)]
        command: ActionCommand,
    },
    /// Read configuration values
    Config {
        #[command(subcommand)]
        command: ConfigCommand,
    },
}

#[derive(Subcommand, Debug, Clone)]
pub enum ActionCommand {
    /// Print all supported action names
    List,
    /// Run one action by name and optional colon-style args
    Run {
        /// Action name
        name: String,
        /// Additional action args
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
}

#[derive(Subcommand, Debug, Clone)]
pub enum ConfigCommand {
    /// Show full config content
    Show {
        /// Show bundled default config instead of active config
        #[arg(long)]
        defaults: bool,
    },
    /// Get one config value by key
    Get {
        /// Config key (for example: shell.default)
        key: String,
    },
    /// Print path of the active config file
    Path,
}

impl Cli {
    pub fn action_payload(&self) -> Option<String> {
        match &self.command {
            Some(CliCommand::Action {
                command: ActionCommand::Run { name, args },
            }) => {
                let mut action_parts = Vec::with_capacity(args.len() + 1);
                action_parts.push(name.clone());
                action_parts.extend(args.clone());
                Some(action_parts.join(":"))
            }
            _ => None,
        }
    }

    pub fn parse_config_set_overrides(&self) -> Result<Vec<(String, String)>, String> {
        let mut parsed_overrides = Vec::with_capacity(self.config_set_overrides.len());

        for override_definition in &self.config_set_overrides {
            let Some((config_key, config_value)) = override_definition.split_once('=') else {
                return Err(format!(
                    "Invalid --set value '{}'. Expected format: key=value",
                    override_definition
                ));
            };

            let trimmed_key = config_key.trim().to_string();
            if trimmed_key.is_empty() {
                return Err(format!(
                    "Invalid --set value '{}'. Key must not be empty",
                    override_definition
                ));
            }

            parsed_overrides.push((trimmed_key, config_value.trim().to_string()));
        }

        Ok(parsed_overrides)
    }

    pub fn serialize_config_set_overrides(&self) -> Result<String, String> {
        let parsed_overrides = self.parse_config_set_overrides()?;
        Ok(parsed_overrides
            .iter()
            .map(|(config_key, config_value)| format!("{}={}", config_key, config_value))
            .collect::<Vec<_>>()
            .join("\n"))
    }
}
