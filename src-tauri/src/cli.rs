use clap::{Parser, ValueEnum};

#[derive(ValueEnum, Debug, Clone)]
enum CommandType {
    OpenTab,
    // später erweiterbar
}

#[derive(Parser, Debug)]
#[command(name = "cogno", version, about = "Cogno CLI")]
struct Cli {
    /// Ausgabe: "hello world"
    #[arg(long)]
    hello_world: bool,

    /// Zeige Konfig
    #[arg(long)]
    show_config: bool,

    /// Zeige Default-Konfig (nur sinnvoll zusammen mit --show-config)
    #[arg(long, requires = "show_config")]
    default: bool,

    /// Führt einen Befehl aus
    #[arg(long, value_enum)]
    command: Option<CommandType>,
}
