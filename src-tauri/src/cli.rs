use clap::{Parser};

#[derive(Parser, Debug, Clone)]
#[command(name = "cogno", version, about = "Cogno CLI")]
pub struct Cli {
    /// Ausgabe: "hello world"
    #[arg(long)]
    pub hello_world: bool,

    /// Zeige Konfig
    #[arg(long)]
    pub show_config: bool,

    /// Zeige Default-Konfig (nur sinnvoll zusammen mit --show-config)
    #[arg(long, requires = "show_config")]
    pub default: bool,

    /// Führt einen Befehl aus
    #[arg(long)]
    pub command: Option<String>,
}
