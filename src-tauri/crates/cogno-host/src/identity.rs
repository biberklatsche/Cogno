pub const TERM_PROGRAM_NAME: &str = "cogno";
pub const HOME_DIRECTORY_NAME: &str = ".cogno";
pub const DEVELOPMENT_HOME_DIRECTORY_NAME: &str = ".cogno-dev";

/// What this machine is called on its network: how a Cogno says who it is
/// to the hosts it talks to.
pub fn machine_name() -> Option<String> {
    sysinfo::System::host_name().filter(|name| !name.is_empty())
}
