use clap::{Arg, Command};

fn main() {
    let matches = Command::new("cogno")
        .disable_help_subcommand(true)
        .arg(
            Arg::new("hello-world")
                .long("hello-world")
                .action(clap::ArgAction::SetTrue)
                .help("Prints 'hello world' to stdout and exits"),
        )
        .arg(
            Arg::new("open-new-tab")
                .long("open-new-tab")
                .action(clap::ArgAction::SetTrue)
                .help("Instruct a running instance to open a new tab (or handle on first launch)"),
        )
        .allow_external_subcommands(true)
        .get_matches();

    if matches.get_flag("hello-world") {
        println!("hello world");
        return;
    }

    // For --open-new-tab we simply continue starting the app.
    // The single-instance plugin will forward the args to the already-running instance
    // and terminate this process. If this is the first instance, lib.rs setup will handle it.

    cogno_lib::run()
}
