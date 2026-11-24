use clap::{ArgAction, Parser, Subcommand};

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
    /// Hand a coding agent's hook, read from stdin, to Cogno (what the hooks
    /// Cogno installs run)
    #[command(hide = true)]
    Hook {
        /// The agent, as Cogno names it
        provider: String,
        /// The agent's hook event
        event: String,
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

/// The webview event an action from the command line arrives as.
pub const CLI_ACTION_EVENT: &str = "cli-action";

/// `name[:arg...]`, as the webview parses an action from the command line.
pub fn action_payload(name: &str, args: &[String]) -> String {
    std::iter::once(name)
        .chain(args.iter().map(String::as_str))
        .collect::<Vec<_>>()
        .join(":")
}

impl Cli {
    pub fn action_payload(&self) -> Option<String> {
        match &self.command {
            Some(CliCommand::Action {
                command: ActionCommand::Run { name, args },
            }) => Some(action_payload(name, args)),
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

/// How long `action run` waits for the Cogno that shows its terminal.
const ACTION_RUN_PATIENCE: std::time::Duration = std::time::Duration::from_secs(10);

/// Inside a Cogno terminal (`COGNO_TERMINAL_ID` set), `action run` asks the
/// Cogno that shows that terminal - through the host that runs it, wherever
/// that Cogno is - and returns the exit code. `None` only when nothing was
/// asked - outside a Cogno terminal, or with no host to ask: the caller
/// falls back to the single-instance path. Once asked, it never falls back:
/// the action may have run, and on another machine that path would start a
/// Cogno there.
pub fn try_run_action_in_terminal(cli: &Cli) -> Option<i32> {
    use crate::relayed::{self, ActionRunStatus, Answer, Question};
    use cogno_host::once::{self, AskError};
    use cogno_host::protocol::Addressee;

    let (name, args) = match &cli.command {
        Some(CliCommand::Action {
            command: ActionCommand::Run { name, args },
        }) => (name, args),
        _ => return None,
    };
    let terminal_id = std::env::var(cogno_host::env_vars::COGNO_TERMINAL_ID)
        .ok()
        .filter(|id| !id.is_empty())?;
    let endpoint = crate::host_endpoint::host_endpoint().ok()?;
    let question = relayed::encode(&Question::RunAction {
        name: name.clone(),
        args: args.clone(),
    });
    let deadline = std::time::Instant::now() + ACTION_RUN_PATIENCE;
    let answer = match once::ask(
        &endpoint,
        Addressee::Terminal { terminal_id },
        question,
        Some(deadline),
    ) {
        Ok(answer) => relayed::decode(&answer),
        Err(AskError::Unreached(error)) => {
            eprintln!("Could not reach the Cogno host ({error}); falling back.");
            return None;
        }
        Err(error) => {
            eprintln!("Action '{}': {error}.", name);
            return Some(1);
        }
    };
    match answer {
        Some(Answer::ActionRun {
            status: ActionRunStatus::Dispatched,
        }) => {
            println!("dispatched: {}", name);
            Some(0)
        }
        Some(Answer::ActionRun {
            status: ActionRunStatus::Inactive,
        }) => {
            eprintln!("Action '{}' is not active (its feature is off).", name);
            Some(2)
        }
        Some(Answer::ActionRun {
            status: ActionRunStatus::NotFound,
        }) => {
            eprintln!("Unknown action: {}", name);
            eprintln!("Use `cogno action list` to see all supported actions.");
            Some(1)
        }
        _ => {
            eprintln!("Unexpected response for action '{}'.", name);
            Some(1)
        }
    }
}
