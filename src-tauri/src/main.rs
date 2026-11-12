#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use clap::Parser;
use cogno_lib::actions_generated::COGNO_ACTIONS;
use cogno_lib::cli::{try_run_action_over_http, ActionCommand, Cli, CliCommand, ConfigCommand};
use cogno_lib::commands::config::read_default_config;
use cogno_lib::commands::environment::get_cogno_config_file_path;
use std::collections::HashMap;
use std::fs;

fn main() {
    // Started by git or ssh as the askpass helper (see commands/askpass.rs):
    // the arguments are the prompt, not a Cogno command line.
    if let Ok(session_id) = std::env::var(cogno_lib::commands::askpass::SESSION_ENV) {
        let prompt_args: Vec<String> = std::env::args().skip(1).collect();
        std::process::exit(cogno_lib::commands::askpass::run_helper(
            &session_id,
            &prompt_args,
        ));
    }

    let cli = Cli::parse();

    // The two roles without a window. `daemon` holds this machine's shells;
    // `server --stdio`, started through ssh by a Cogno on another machine,
    // passes that Cogno's bytes to the daemon until it hangs up.
    match &cli.command {
        Some(CliCommand::Daemon { endpoint }) => {
            let ran = host_endpoint(endpoint).and_then(|endpoint| {
                cogno_host::daemon::run(&endpoint, Default::default())
                    .map_err(|error| error.to_string())
            });
            std::process::exit(exit_code_of(ran));
        }
        Some(CliCommand::Server { endpoint, .. }) => {
            let passed = host_endpoint(endpoint).and_then(|endpoint| {
                cogno_host::daemon::bridge(&endpoint, std::io::stdin(), std::io::stdout())
                    .map_err(|_| "No Cogno is running on this machine".to_string())
            });
            std::process::exit(exit_code_of(passed));
        }
        _ => {}
    }

    if let Err(error_message) = apply_cli_environment(&cli) {
        eprintln!("{}", error_message);
        std::process::exit(1);
    }

    // Inside a running Cogno terminal, `action run` goes over HTTP and gets a
    // real reply; otherwise fall back to validation + the single-instance path.
    if let Some(exit_code) = try_run_action_over_http(&cli) {
        std::process::exit(exit_code);
    }

    validate_action_run_command(&cli);

    if execute_cli_only_command(&cli) {
        return;
    }

    // Start Tauri App
    cogno_lib::run(cli);
}

/// The endpoint file a windowless role works with: the one it was given, or
/// this user's.
fn host_endpoint(given: &Option<std::path::PathBuf>) -> Result<std::path::PathBuf, String> {
    match given {
        Some(path) => Ok(path.clone()),
        None => cogno_host::daemon::endpoint_path(cfg!(debug_assertions)),
    }
}

/// Says on stderr why a windowless role failed; stdout is the connection.
fn exit_code_of(outcome: Result<(), String>) -> i32 {
    match outcome {
        Ok(()) => 0,
        Err(reason) => {
            eprintln!("{reason}");
            1
        }
    }
}

fn apply_cli_environment(cli: &Cli) -> Result<(), String> {
    if let Some(config_path) = &cli.config {
        std::env::set_var("COGNO_CONFIG_PATH", config_path);
    }

    let serialized_overrides = cli.serialize_config_set_overrides()?;
    if !serialized_overrides.is_empty() {
        std::env::set_var("COGNO_CONFIG_SET_OVERRIDES", serialized_overrides);
    }

    Ok(())
}

fn execute_cli_only_command(cli: &Cli) -> bool {
    match &cli.command {
        Some(CliCommand::Config { command }) => {
            execute_config_command(cli, command);
            true
        }
        Some(CliCommand::Action {
            command: ActionCommand::List,
        }) => {
            for (action_name, description) in COGNO_ACTIONS {
                println!("{}	{}", action_name, description);
            }
            true
        }
        _ => false,
    }
}

fn execute_config_command(cli: &Cli, command: &ConfigCommand) {
    match command {
        ConfigCommand::Show { defaults } => {
            if *defaults {
                match read_default_config() {
                    Ok(content) => println!("{}", content),
                    Err(error) => {
                        eprintln!("Error reading default config: {}", error);
                        std::process::exit(1);
                    }
                }
                return;
            }

            let config_path = resolve_active_config_path();
            match fs::read_to_string(&config_path) {
                Ok(content) => {
                    println!("{}", content);
                    if !cli.config_set_overrides.is_empty() {
                        let serialized_overrides =
                            cli.serialize_config_set_overrides().unwrap_or_default();
                        if !serialized_overrides.is_empty() {
                            println!("\n# CLI overrides");
                            println!("{}", serialized_overrides);
                        }
                    }
                }
                Err(error) => {
                    eprintln!("Error reading config file at {}: {}", config_path, error);
                    std::process::exit(1);
                }
            }
        }
        ConfigCommand::Get { key } => {
            let config_path = resolve_active_config_path();
            let default_config_string = match read_default_config() {
                Ok(content) => content,
                Err(error) => {
                    eprintln!("Error reading default config: {}", error);
                    std::process::exit(1);
                }
            };

            let user_config_string = fs::read_to_string(&config_path).unwrap_or_default();
            let mut merged_values = parse_config_key_value_lines(&default_config_string);
            merged_values.extend(parse_config_key_value_lines(&user_config_string));

            match cli.parse_config_set_overrides() {
                Ok(parsed_overrides) => {
                    for (config_key, config_value) in parsed_overrides {
                        merged_values.insert(config_key, config_value);
                    }
                }
                Err(error_message) => {
                    eprintln!("{}", error_message);
                    std::process::exit(1);
                }
            }

            if let Some(value) = merged_values.get(key) {
                println!("{}", value);
            } else {
                eprintln!("Config key not found: {}", key);
                std::process::exit(1);
            }
        }
        ConfigCommand::Path => {
            println!("{}", resolve_active_config_path());
        }
    }
}

fn resolve_active_config_path() -> String {
    let dev_mode = cfg!(debug_assertions);
    match get_cogno_config_file_path(dev_mode) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("Error determining config file path: {}", error);
            std::process::exit(1);
        }
    }
}

fn parse_config_key_value_lines(config_content: &str) -> HashMap<String, String> {
    let mut parsed_values = HashMap::new();

    for raw_line in config_content.lines() {
        let trimmed_line = raw_line.trim();
        if trimmed_line.is_empty() || trimmed_line.starts_with('#') {
            continue;
        }

        let Some((key, value)) = trimmed_line.split_once('=') else {
            continue;
        };

        let normalized_key = key.trim().to_string();
        if normalized_key.is_empty() {
            continue;
        }

        parsed_values.insert(normalized_key, value.trim().to_string());
    }

    parsed_values
}

fn validate_action_run_command(cli: &Cli) {
    let Some(CliCommand::Action {
        command: ActionCommand::Run { name, .. },
    }) = &cli.command
    else {
        return;
    };

    if COGNO_ACTIONS
        .iter()
        .any(|(action_name, _)| *action_name == name.as_str())
    {
        return;
    }

    eprintln!("Unsupported action name: {}", name);
    eprintln!("Use `cogno action list` to see all supported actions.");
    std::process::exit(1);
}
