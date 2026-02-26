#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use clap::Parser;
use cogno_lib::cli::Cli;
use cogno_lib::commands::config::read_default_config;
use cogno_lib::commands::environment::get_cogno_config_file_path;
use std::fs;

fn main() {
    let cli = Cli::parse();

    if cli.hello_world {
        println!("hello world");
        return;
    }
    // --show-config (mit optional --default)
    if cli.show_config {
        if cli.default {
            match read_default_config() {
                Ok(content) => println!("{}", content),
                Err(e) => eprintln!("Error reading default config: {}", e),
            }
        } else {
            let dev_mode = cfg!(debug_assertions);
            match get_cogno_config_file_path(dev_mode) {
                Ok(config_path) => match fs::read_to_string(&config_path) {
                    Ok(content) => println!("{}", content),
                    Err(e) => eprintln!("Error reading config file at {}: {}", config_path, e),
                },
                Err(e) => eprintln!("Error determining config file path: {}", e),
            }
        }
        return;
    }

    // Start Tauri App
    cogno_lib::run(cli)
}
