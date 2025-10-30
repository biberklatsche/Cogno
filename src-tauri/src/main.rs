use cogno_lib::cli::parse_cli;
use cogno_lib::commands::config::read_default_config;
use cogno_lib::commands::environment::get_cogno_config_file_path;
use std::fs;

fn main() {
    let matches = parse_cli();

    // `--hello-world`: print and exit early
    if matches.get_flag("hello-world") {
        println!("hello world");
        return;
    }

    // Support `cogno +show-config` and `cogno +show-config --default` via either flag or external subcommand
    let show_config = matches.get_flag("show-config");
    let default_cfg = matches.get_flag("default");

    if show_config {
        if default_cfg {
            match read_default_config() {
                Ok(content) => println!("{}", content),
                Err(e) => eprintln!("Error reading default config: {}", e),
            }
        } else {
            let dev_mode = cfg!(debug_assertions);
            match get_cogno_config_file_path(dev_mode) {
                Ok(config_path) => {
                    match fs::read_to_string(&config_path) {
                        Ok(content) => println!("{}", content),
                        Err(e) => eprintln!("Error reading config file at {}: {}", config_path, e),
                    }
                }
                Err(e) => eprintln!("Error determining config file path: {}", e),
            }
        }
        return;
    }

    cogno_lib::run(matches)
}
