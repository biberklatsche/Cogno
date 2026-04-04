#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use clap::Parser;
use cogno_tauri_core::cli::{ActionCommand, Cli, CliCommand, ConfigCommand, COGNO_ACTION_NAMES};
use cogno_tauri_core::commands::config::read_default_config;
use cogno_tauri_core::commands::environment::get_cogno_config_file_path;
use cogno_tauri_core::{initialize_app_identity, AppIdentity};
use std::collections::HashMap;
use std::fs;

fn main() {
    initialize_app_identity(AppIdentity::new(
        "cogno",
        ".cogno",
        ".cogno-dev",
    ));

    let cli = Cli::parse();

    if let Err(error_message) = apply_cli_environment(&cli) {
        eprintln!("{}", error_message);
        std::process::exit(1);
    }

    validate_action_run_command(&cli);

    if execute_cli_only_command(&cli) {
        return;
    }

    // Start Tauri App
    cogno_lib::run(cli);
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
            for action_name in COGNO_ACTION_NAMES {
                println!("{}", action_name);
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

    if COGNO_ACTION_NAMES.contains(&name.as_str()) {
        return;
    }

    eprintln!("Unsupported action name: {}", name);
    eprintln!("Use `cogno action list` to see all supported actions.");
    std::process::exit(1);
}
