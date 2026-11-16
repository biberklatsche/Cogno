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
    /// Connect a Cogno on another machine to the shells of this one
    Server {
        /// Talk over stdin and stdout (what ssh connects)
        #[arg(long, required = true)]
        stdio: bool,
        /// The endpoint file of the daemon to reach, instead of the user's
        #[arg(long, hide = true, value_name = "path")]
        endpoint: Option<std::path::PathBuf>,
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
    /// Run the process that holds this machine's shells (started by Cogno)
    Daemon {
        /// The endpoint file to announce itself in, instead of the user's
        #[arg(long, hide = true, value_name = "path")]
        endpoint: Option<std::path::PathBuf>,
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

/// How long `action run` waits for the Cogno that shows its terminal.
const ACTION_RUN_PATIENCE: std::time::Duration = std::time::Duration::from_secs(10);

/// Inside a Cogno terminal (`COGNO_TERMINAL_ID` set), `action run` asks the
/// Cogno that shows that terminal - through the host that runs it, wherever
/// that Cogno is - and returns the exit code; otherwise `None`, and the caller
/// falls back to the single-instance path.
pub fn try_run_action_in_terminal(cli: &Cli) -> Option<i32> {
    use cogno_host::protocol::{ActionRunStatus, Answer, Question};

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
    let question = Question::RunAction {
        terminal_id,
        name: name.clone(),
        args: args.clone(),
    };
    let answer = match cogno_host::once::ask(&endpoint, question, Some(ACTION_RUN_PATIENCE)) {
        Ok(Ok(answer)) => answer,
        Ok(Err(refused)) => {
            eprintln!("{}; falling back.", refused.message);
            return None;
        }
        Err(error) => {
            eprintln!("Could not reach the Cogno host ({error}); falling back.");
            return None;
        }
    };
    match answer {
        Answer::ActionRun {
            status: ActionRunStatus::Dispatched,
        } => {
            println!("dispatched: {}", name);
            Some(0)
        }
        Answer::ActionRun {
            status: ActionRunStatus::Inactive,
        } => {
            eprintln!("Action '{}' is not active (its feature is off).", name);
            Some(2)
        }
        Answer::ActionRun {
            status: ActionRunStatus::NotFound,
        } => {
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

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;
    use cogno_host::daemon_start::{BRIDGE_ARGUMENTS, DAEMON_ARGUMENT};

    /// The host starts the daemon and the starter runs the bridge by these
    /// arguments: they must be the ones this command line takes.
    #[test]
    fn the_arguments_the_host_uses_are_the_ones_parsed_here() {
        let daemon = Cli::try_parse_from(["cogno", DAEMON_ARGUMENT]).unwrap();
        assert!(matches!(daemon.command, Some(CliCommand::Daemon { .. })));

        let bridge =
            Cli::try_parse_from(std::iter::once("cogno").chain(BRIDGE_ARGUMENTS.split(' ')))
                .unwrap();
        assert!(matches!(
            bridge.command,
            Some(CliCommand::Server { stdio: true, .. })
        ));
    }
}
