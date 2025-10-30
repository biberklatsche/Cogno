use cogno_lib::cli::parse_cli;
use cogno_lib::settings::read_default_settings;

fn main() {
    let matches = parse_cli();

    if matches.get_flag("hello-world") {
        match read_default_settings() {
            Ok(content) => println!("{}", content),
            Err(e) => eprintln!("Error reading default settings: {}", e),
        }
        return;
    }

    cogno_lib::run(matches)
}
