//! Which host a process of this binary talks to when it has one thing to
//! say: a coding agent's hook, `cogno action run` in a terminal, an askpass
//! prompt (ARCHITECTURE.md 2.7.1, "Weitergabe").

use std::path::PathBuf;

use cogno_host::env_vars::COGNO_HOST;

/// The endpoint file of the host the environment names (`COGNO_HOST`: the
/// host sets it for every shell it starts, the app for every process it asks
/// through), else this build's own. So a `cogno` of another build, typed in a
/// shell, still reaches the host that runs that shell.
pub fn host_endpoint() -> Result<PathBuf, String> {
    match std::env::var(COGNO_HOST) {
        Ok(named) if !named.is_empty() => Ok(PathBuf::from(named)),
        _ => own_host_endpoint(),
    }
}

/// The endpoint file of this app's own host.
pub fn own_host_endpoint() -> Result<PathBuf, String> {
    cogno_host::daemon::endpoint_path(cfg!(debug_assertions))
}
