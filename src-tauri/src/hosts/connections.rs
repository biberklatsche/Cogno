//! The connections this app holds: one to this machine's daemon, and one to
//! each host on another machine it is connected to.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::HostConnection;

#[derive(Default)]
pub struct Connections {
    /// The connection to this machine's daemon, once there was one.
    local: Mutex<Option<Arc<HostConnection>>>,
    /// The connections to other machines, by the name the config gives them.
    remotes: Mutex<HashMap<String, Arc<HostConnection>>>,
    /// One connection to another machine is set up at a time: two panes of
    /// one host restored together share a connection instead of each starting
    /// one, and the user is asked one password at a time.
    connecting_remote: Mutex<()>,
    /// The same for this machine's daemon, apart from the other machines: a
    /// password ssh waits for must not hold up the terminals here.
    connecting_local: Mutex<()>,
}

/// What a lost connection means for its host.
#[derive(Debug, PartialEq, Eq)]
pub enum Lost {
    /// The host is gone from this app: the connection was its current one,
    /// or the host was hung up on.
    HostGone,
    /// A newer connection to the host stands; only this one ended.
    Replaced,
}

impl Connections {
    fn live_local(&self) -> Option<Arc<HostConnection>> {
        lock(&self.local)
            .as_ref()
            .filter(|connection| !connection.is_lost())
            .cloned()
    }

    /// The connection to this machine's daemon, set up by `open` when there
    /// is none that stands.
    pub fn local(
        &self,
        open: impl FnOnce() -> CommandResult<HostConnection>,
    ) -> CommandResult<Arc<HostConnection>> {
        if let Some(connected) = self.live_local() {
            return Ok(connected);
        }
        let _one_at_a_time = lock(&self.connecting_local);
        if let Some(connected) = self.live_local() {
            return Ok(connected);
        }
        let connection = Arc::new(open()?);
        *lock(&self.local) = Some(connection.clone());
        Ok(connection)
    }

    pub fn remote(&self, name: &str) -> CommandResult<Arc<HostConnection>> {
        lock(&self.remotes)
            .get(name)
            .filter(|remote| !remote.is_lost())
            .cloned()
            .ok_or_else(|| {
                CommandError::new(
                    AppErrorCode::NotConnected,
                    format!("Not connected to the host {name}"),
                )
            })
    }

    /// The connection to the host `name`, set up by `open` unless one
    /// stands.
    pub fn connect_remote(
        &self,
        name: &str,
        open: impl FnOnce() -> CommandResult<HostConnection>,
    ) -> CommandResult<Arc<HostConnection>> {
        let _one_at_a_time = lock(&self.connecting_remote);
        if let Ok(connected) = self.remote(name) {
            return Ok(connected);
        }
        let connection = Arc::new(open()?);
        lock(&self.remotes).insert(name.to_string(), connection.clone());
        // Lost before it was put in its place: its end found nothing to take
        // out, so it is taken out here.
        if connection.is_lost() {
            lock(&self.remotes).remove(name);
            return Err(CommandError::connection_lost());
        }
        Ok(connection)
    }

    /// The connection `connection` to `host` ended (`None` is this machine's
    /// daemon): taken out if it is the host's current one.
    pub fn forget(&self, host: Option<&str>, connection: u64) -> Lost {
        let is_it = |slot: Option<&Arc<HostConnection>>| {
            slot.is_some_and(|current| current.id() == connection)
        };
        match host {
            None => {
                let mut local = lock(&self.local);
                if !is_it(local.as_ref()) {
                    return Lost::Replaced;
                }
                *local = None;
                Lost::HostGone
            }
            Some(name) => {
                let mut remotes = lock(&self.remotes);
                if is_it(remotes.get(name)) {
                    remotes.remove(name);
                    return Lost::HostGone;
                }
                // Not in the map at all: it was hung up on.
                if remotes.contains_key(name) {
                    Lost::Replaced
                } else {
                    Lost::HostGone
                }
            }
        }
    }

    /// Hangs up on the host `name`.
    pub fn disconnect(&self, name: &str) {
        lock(&self.remotes).remove(name);
    }

    /// Every connection that stands, this machine's included.
    pub fn all(&self) -> Vec<Arc<HostConnection>> {
        let mut connections: Vec<Arc<HostConnection>> =
            lock(&self.remotes).values().cloned().collect();
        connections.extend(lock(&self.local).clone());
        connections
    }

    /// Hangs up on every host.
    pub fn clear(&self) {
        lock(&self.remotes).clear();
        *lock(&self.local) = None;
    }
}
