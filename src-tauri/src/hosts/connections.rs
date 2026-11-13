//! The connections this app holds: one to this machine's daemon, and one to
//! each host on another machine it is connected to.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::{HangUp, HostConnection, Starting};

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
    /// The connection to another machine being set up, by the host's name,
    /// and what gives up on it.
    setting_up: Mutex<Option<(String, HangUp)>>,
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

    /// The connection `id` to `host` (`None` is this machine's daemon), while
    /// it stands: never another one, and never one set up for the asking.
    pub fn current(&self, host: Option<&str>, id: u64) -> CommandResult<Arc<HostConnection>> {
        let connection = match host {
            None => lock(&self.local).clone(),
            Some(name) => lock(&self.remotes).get(name).cloned(),
        };
        connection
            .filter(|connection| connection.id() == id && !connection.is_lost())
            .ok_or_else(CommandError::connection_lost)
    }

    /// The connection to the host `name`: `start` starts its process unless
    /// one stands, and `introduce` waits for the host there. Hanging up on
    /// `name` meanwhile gives up on it.
    pub fn connect_remote(
        &self,
        name: &str,
        start: impl FnOnce() -> CommandResult<Starting>,
        introduce: impl FnOnce(Starting) -> CommandResult<HostConnection>,
    ) -> CommandResult<Arc<HostConnection>> {
        let _one_at_a_time = lock(&self.connecting_remote);
        if let Ok(connected) = self.remote(name) {
            return Ok(connected);
        }
        let starting = start()?;
        *lock(&self.setting_up) = Some((name.to_string(), starting.ender()));
        let introduced = introduce(starting);
        let given_up = lock(&self.setting_up).take().is_none();
        if given_up {
            if let Ok(connection) = introduced {
                connection.hang_up();
            }
            return Err(CommandError::new(
                AppErrorCode::ConnectionLost,
                format!("The connection to {name} was hung up"),
            ));
        }
        let connection = Arc::new(introduced?);
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

    /// Hangs up on the host `name`, and gives up on a connection to it that
    /// is being set up.
    pub fn disconnect(&self, name: &str) {
        let standing = lock(&self.remotes).remove(name);
        if let Some(connection) = standing {
            connection.hang_up();
        }
        let setting_up = {
            let mut setting_up = lock(&self.setting_up);
            match setting_up.as_ref() {
                Some((host, _)) if host == name => setting_up.take(),
                _ => None,
            }
        };
        if let Some((_, give_up)) = setting_up {
            give_up();
        }
    }

    /// Every connection that stands, this machine's included.
    pub fn all(&self) -> Vec<Arc<HostConnection>> {
        let mut connections: Vec<Arc<HostConnection>> =
            lock(&self.remotes).values().cloned().collect();
        connections.extend(lock(&self.local).clone());
        connections
    }

    /// Hangs up on every host, and gives up on a connection being set up.
    pub fn clear(&self) {
        let remotes: Vec<_> = lock(&self.remotes).drain().map(|(_, c)| c).collect();
        let local = lock(&self.local).take();
        for connection in remotes.into_iter().chain(local) {
            connection.hang_up();
        }
        if let Some((_, give_up)) = lock(&self.setting_up).take() {
            give_up();
        }
    }
}
