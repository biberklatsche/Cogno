use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "cogno", version, about = "Cogno CLI")]
pub struct Cli {
    /// Output: "hello world"
    #[arg(long)]
    pub hello_world: bool,

    /// Show config
    #[arg(long)]
    pub show_config: bool,

    /// Show default config (only useful together with --show-config)
    #[arg(long, requires = "show_config")]
    pub default: bool,

    /// Executes a action
    #[arg(long)]
    pub action: Option<String>,
}
