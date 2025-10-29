use clap::{Arg, Command};
use cogno_lib::cli::parse_cli;

fn main() {
    let matches = parse_cli();

    if matches.get_flag("hello-world") {
        println!("hello world");
            return;
        }

    cogno_lib::run(matches)
}
