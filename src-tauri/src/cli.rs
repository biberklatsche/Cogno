use clap::{Arg, ArgAction, ArgMatches, Command};

pub fn build_cli() -> Command {
    Command::new("cogno")
        .disable_help_subcommand(true)
        .arg(
            Arg::new("hello-world")
                .long("hello-world")
                .action(ArgAction::SetTrue)
                .help("Prints 'hello world' to stdout and exits"),
        )
        .arg(
            Arg::new("open-new-tab")
                .long("open-new-tab")
                .action(ArgAction::SetTrue)
                .help("Instruct a running instance to open a new tab (or handle on first launch)"),
        )
        .arg(
            Arg::new("default")
                .long("default")
                .action(ArgAction::SetTrue)
                .help("When used with +show-config, prints the default config instead of the user config"),
        )
        .allow_external_subcommands(true)
}

// Für main()
pub fn parse_cli() -> ArgMatches {
    build_cli().get_matches()
}

// Für single_instance (argv vom Zweitprozess)
pub fn parse_cli_from_argv(argv: Vec<String>) -> ArgMatches {
    // 1) Direkt versuchen
    if let Ok(m) = build_cli().try_get_matches_from(argv.clone()) {
        return m;
    }
    // 2) Falls Binary-Name fehlt
    build_cli()
        .no_binary_name(true)
        .try_get_matches_from(argv)
        .unwrap_or_else(|_| build_cli().get_matches_from(["cogno"])) // letzter Fallback: leere Matches
}
