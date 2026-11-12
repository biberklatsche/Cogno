pub const TERM_PROGRAM_NAME: &str = "cogno";
pub const HOME_DIRECTORY_NAME: &str = ".cogno";
pub const DEVELOPMENT_HOME_DIRECTORY_NAME: &str = ".cogno-dev";

/// The Cogno home under the user's home: `.cogno`, or `.cogno-dev` in
/// development.
pub fn cogno_home(dev_mode: bool) -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(if dev_mode {
        DEVELOPMENT_HOME_DIRECTORY_NAME
    } else {
        HOME_DIRECTORY_NAME
    }))
}

/// What this machine is called on its network: how a Cogno says who it is
/// to the hosts it talks to.
pub fn machine_name() -> Option<String> {
    sysinfo::System::host_name().filter(|name| !name.is_empty())
}
