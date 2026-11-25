//! The connections this app holds: one to this machine's host, and one to
//! each host on another machine it is connected to.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::{Ending, HangUp, HostConnection};

/// How far the connection to a machine is, for every window to show; a
/// machine without one is not connected.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum RemoteState {
    Connecting,
    Connected,
    Failed { failure: CommandError },
}

pub struct Connections {
    /// Told whenever a machine's `RemoteState` changed.
    on_change: Box<dyn Fn() + Send + Sync>,
    /// The connection to this machine's host, once there was one.
    local: Mutex<Option<Arc<HostConnection>>>,
    /// One connection to this machine's host is set up at a time, apart
    /// from the other machines: one that does not answer must not hold up
    /// the terminals here.
    connecting_local: Mutex<()>,
    /// The other machines, by the id they are paired under.
    remotes: Mutex<HashMap<String, Remote>>,
}

/// What this app has to do with one other machine: its connection, how far
/// that is, and the connects to it.
#[derive(Default)]
struct Remote {
    /// The connection, while one stands.
    connection: Option<Arc<HostConnection>>,
    /// How far the connection is, as the windows show it.
    state: Option<RemoteState>,
    /// Held while a connection to the host is set up: two panes of one host
    /// restored together share a connection instead of each starting one.
    /// A turn per machine: one that is not reached holds up no other.
    turn: Arc<Mutex<()>>,
    /// How the host's connects are given up: hanging up on it counts up,
    /// and a connect that sees the count change - while it waits for its
    /// turn, or once the host answered - gives up.
    hang_ups: u64,
    /// Ends the connect in progress.
    ender: Option<HangUp>,
}

impl Remote {
    fn live(&self) -> Option<Arc<HostConnection>> {
        self.connection
            .as_ref()
            .filter(|connection| !connection.is_lost())
            .cloned()
    }
}

impl Connections {
    /// Connections whose remote states `on_change` hears change.
    pub fn telling(on_change: impl Fn() + Send + Sync + 'static) -> Self {
        Self {
            on_change: Box::new(on_change),
            local: Mutex::default(),
            connecting_local: Mutex::default(),
            remotes: Mutex::default(),
        }
    }

    /// How far the connection to each machine is, by its id.
    pub fn states(&self) -> HashMap<String, RemoteState> {
        lock(&self.remotes)
            .iter()
            .filter_map(|(id, remote)| Some((id.clone(), remote.state.clone()?)))
            .collect()
    }

    /// Does `work` with what is known of the machine `id`, and tells of it
    /// when that changed how far its connection is.
    fn with<T>(&self, id: &str, work: impl FnOnce(&mut Remote) -> T) -> T {
        let (result, changed) = {
            let mut remotes = lock(&self.remotes);
            let remote = remotes.entry(id.to_string()).or_default();
            let before = remote.state.clone();
            let result = work(remote);
            (result, remote.state != before)
        };
        if changed {
            (self.on_change)();
        }
        result
    }

    fn live_local(&self) -> Option<Arc<HostConnection>> {
        lock(&self.local)
            .as_ref()
            .filter(|connection| !connection.is_lost())
            .cloned()
    }

    /// The connection to this machine's host, set up by `open` when there
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

    pub fn remote(&self, id: &str) -> CommandResult<Arc<HostConnection>> {
        lock(&self.remotes)
            .get(id)
            .and_then(Remote::live)
            .ok_or_else(|| {
                CommandError::new(AppErrorCode::NotConnected, "Not connected to that machine")
            })
    }

    /// The connection `id` to `host` (`None` is this machine's), while
    /// it stands: never another one, and never one set up for the asking.
    pub fn current(&self, host: Option<&str>, id: u64) -> CommandResult<Arc<HostConnection>> {
        let connection = match host {
            None => self.live_local(),
            Some(host) => lock(&self.remotes).get(host).and_then(Remote::live),
        };
        connection
            .filter(|connection| connection.id() == id)
            .ok_or_else(CommandError::connection_lost)
    }

    /// The connection to the host `id`, unless one stands: `start` sets
    /// out for it, and says what gives up on that; `introduce` waits for
    /// the host there. Hanging up on `id` meanwhile gives up on it - also
    /// while it waits for its turn.
    pub fn connect_remote<U>(
        &self,
        id: &str,
        start: impl FnOnce() -> CommandResult<(U, HangUp)>,
        introduce: impl FnOnce(U) -> CommandResult<HostConnection>,
    ) -> CommandResult<Arc<HostConnection>> {
        let (hang_ups, turn) = self.with(id, |remote| {
            if remote.live().is_none() {
                remote.state = Some(RemoteState::Connecting);
            }
            (remote.hang_ups, remote.turn.clone())
        });
        let connected = {
            let _one_at_a_time = lock(&turn);
            self.connect_in_turn(id, hang_ups, start, introduce)
        };
        if let Err(failure) = &connected {
            self.with(id, |remote| {
                // Hung up on meanwhile: what came of this connect is no news.
                if remote.hang_ups == hang_ups && remote.live().is_none() {
                    remote.state = Some(RemoteState::Failed {
                        failure: failure.clone(),
                    });
                }
            });
        }
        connected
    }

    fn connect_in_turn<U>(
        &self,
        id: &str,
        hang_ups: u64,
        start: impl FnOnce() -> CommandResult<(U, HangUp)>,
        introduce: impl FnOnce(U) -> CommandResult<HostConnection>,
    ) -> CommandResult<Arc<HostConnection>> {
        let given_up = || self.with(id, |remote| remote.hang_ups != hang_ups);
        if let Ok(connection) = self.remote(id) {
            return Ok(connection);
        }
        if given_up() {
            return Err(hung_up());
        }
        let (starting, ender) = start()?;
        // Hung up on before the ender was there to be called.
        let too_late = self.with(id, |remote| {
            if remote.hang_ups != hang_ups {
                return Some(ender);
            }
            remote.ender = Some(ender);
            None
        });
        if let Some(ender) = too_late {
            ender();
            return Err(hung_up());
        }
        let introduced = introduce(starting);
        let connection = match introduced {
            Ok(connection) => Arc::new(connection),
            Err(failure) => {
                self.with(id, |remote| remote.ender = None);
                return Err(failure);
            }
        };
        let in_place = self.with(id, |remote| {
            remote.ender = None;
            if remote.hang_ups != hang_ups || connection.is_lost() {
                return false;
            }
            remote.connection = Some(connection.clone());
            remote.state = Some(RemoteState::Connected);
            true
        });
        if in_place {
            return Ok(connection);
        }
        if connection.is_lost() {
            return Err(CommandError::connection_lost());
        }
        connection.hang_up();
        Err(hung_up())
    }

    /// The connection `connection` to `host` ended (`None` is this
    /// machine's): taken out if it is the host's current one, and whether
    /// it was. One to another machine that broke is said to have, until
    /// that machine is connected again or hung up on.
    pub fn ended(&self, host: Option<&str>, connection: u64, ending: Ending) -> bool {
        let is_it = |slot: &Option<Arc<HostConnection>>| {
            slot.as_ref()
                .is_some_and(|current| current.id() == connection)
        };
        match host {
            None => {
                let mut local = lock(&self.local);
                let was_current = is_it(&local);
                if was_current {
                    *local = None;
                }
                was_current
            }
            Some(id) => self.with(id, |remote| {
                if !is_it(&remote.connection) {
                    return false;
                }
                remote.connection = None;
                remote.state = (ending == Ending::Lost).then(|| RemoteState::Failed {
                    failure: CommandError::connection_lost(),
                });
                true
            }),
        }
    }

    /// Hangs up on the hosts `which` names, and gives up on the connections
    /// to them that are being set up or wait to be.
    fn hang_up(&self, which: impl Fn(&str) -> bool) {
        let mut changed = false;
        let mut standing = Vec::new();
        let mut enders = Vec::new();
        for (_, remote) in lock(&self.remotes).iter_mut().filter(|(id, _)| which(id)) {
            remote.hang_ups += 1;
            standing.extend(remote.connection.take());
            enders.extend(remote.ender.take());
            changed |= remote.state.take().is_some();
        }
        for connection in standing {
            connection.hang_up();
        }
        for end in enders {
            end();
        }
        if changed {
            (self.on_change)();
        }
    }

    /// Hangs up on the host `id`, and gives up on a connection to it that
    /// is being set up or waits to be.
    pub fn disconnect(&self, id: &str) {
        self.hang_up(|host| host == id);
    }

    /// Every connection that stands, this machine's included.
    pub fn all(&self) -> Vec<Arc<HostConnection>> {
        let mut connections: Vec<Arc<HostConnection>> = lock(&self.remotes)
            .values()
            .filter_map(|remote| remote.connection.clone())
            .collect();
        connections.extend(lock(&self.local).clone());
        connections
    }

    /// Hangs up on every host, and gives up on every connection being set
    /// up or waiting to be.
    pub fn clear(&self) {
        self.hang_up(|_| true);
        if let Some(local) = lock(&self.local).take() {
            local.hang_up();
        }
    }
}

fn hung_up() -> CommandError {
    CommandError::new(AppErrorCode::ConnectionLost, "The connection was hung up")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host_connection::test_support::a_standing_connection;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc;
    use std::time::Duration;

    /// A connect on its way that nothing has to give up on.
    fn setting() -> ((), HangUp) {
        ((), Box::new(|| {}))
    }

    #[test]
    fn a_host_that_introduces_itself_is_connected_once() {
        let connections = Connections::telling(|| {});
        let connect = || {
            connections.connect_remote("office", || Ok(setting()), |_| Ok(a_standing_connection()))
        };

        let first = connect().unwrap();
        let second = connect().unwrap();

        assert_eq!(first.id(), second.id());
    }

    #[test]
    fn a_hang_up_while_the_connect_starts_ends_it_before_anything_waits_for_it() {
        let connections = Connections::telling(|| {});
        let ended = Arc::new(AtomicBool::new(false));
        let mut introduced = false;

        let given_up = connections.connect_remote(
            "office",
            || {
                // Hung up on before its ender was stored.
                connections.disconnect("office");
                let ended = ended.clone();
                Ok((
                    (),
                    Box::new(move || ended.store(true, Ordering::SeqCst)) as HangUp,
                ))
            },
            |_| {
                introduced = true;
                Ok(a_standing_connection())
            },
        );

        assert!(given_up.err().unwrap().is(AppErrorCode::ConnectionLost));
        assert!(!introduced);
        assert!(ended.load(Ordering::SeqCst));
    }

    #[test]
    fn a_host_that_does_not_introduce_itself_is_not_connected() {
        let connections = Connections::telling(|| {});

        let failed = connections.connect_remote(
            "office",
            || Ok(setting()),
            |_| Err(CommandError::new(AppErrorCode::ConnectFailed, "denied")),
        );

        assert!(failed.err().unwrap().is(AppErrorCode::ConnectFailed));
        assert!(connections.remote("office").is_err());
    }

    #[test]
    fn every_change_of_how_far_a_connection_is_is_told() {
        let told = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let connections = {
            let told = told.clone();
            Connections::telling(move || {
                told.fetch_add(1, Ordering::SeqCst);
            })
        };
        let state = |id: &str| connections.states().get(id).cloned();

        let failed = connections.connect_remote(
            "office",
            || {
                assert_eq!(state("office"), Some(RemoteState::Connecting));
                Ok(setting())
            },
            |_| Err(CommandError::new(AppErrorCode::ConnectFailed, "denied")),
        );
        let failure = failed.err().unwrap();
        assert_eq!(state("office"), Some(RemoteState::Failed { failure }));

        let connected = connections
            .connect_remote("office", || Ok(setting()), |_| Ok(a_standing_connection()))
            .unwrap();
        assert_eq!(state("office"), Some(RemoteState::Connected));
        // Connecting, failed, connecting, connected.
        assert_eq!(told.load(Ordering::SeqCst), 4);

        // Asked for again while it stands: nothing changes.
        connections
            .connect_remote("office", || Ok(setting()), |_| Ok(a_standing_connection()))
            .unwrap();
        assert_eq!(told.load(Ordering::SeqCst), 4);

        // An older connection that ends is none of the host's business.
        assert!(!connections.ended(Some("office"), connected.id() + 1, Ending::Lost));
        assert_eq!(state("office"), Some(RemoteState::Connected));
        assert!(connections.ended(Some("office"), connected.id(), Ending::Lost));
        assert!(matches!(state("office"), Some(RemoteState::Failed { .. })));
        assert!(connections.remote("office").is_err());

        connections.disconnect("office");
        assert_eq!(state("office"), None);
        assert_eq!(told.load(Ordering::SeqCst), 6);
    }

    #[test]
    fn a_connect_that_was_hung_up_on_leaves_the_host_not_connected() {
        let connections = Connections::telling(|| {});

        let given_up = connections.connect_remote(
            "office",
            || {
                connections.disconnect("office");
                Ok(setting())
            },
            |_| Ok(a_standing_connection()),
        );

        assert!(given_up.is_err());
        assert_eq!(connections.states().get("office"), None);
    }

    #[test]
    fn a_connect_that_waits_for_its_turn_is_given_up_when_hung_up_on() {
        let connections = Arc::new(Connections::telling(|| {}));
        let (release, released) = mpsc::channel::<()>();
        let (entered, entering) = mpsc::channel::<()>();
        // The first connect to the office takes its time to answer.
        let first = {
            let connections = connections.clone();
            std::thread::spawn(move || {
                connections.connect_remote(
                    "office",
                    || Ok(setting()),
                    |_| {
                        entered.send(()).unwrap();
                        released.recv().unwrap();
                        Ok(a_standing_connection())
                    },
                )
            })
        };
        entering.recv().unwrap();
        // A second one waits for its turn; another machine does not.
        assert!(connections
            .connect_remote("home", || Ok(setting()), |_| Ok(a_standing_connection()))
            .is_ok());
        let second = {
            let connections = connections.clone();
            std::thread::spawn(move || {
                connections.connect_remote(
                    "office",
                    || -> CommandResult<((), HangUp)> { panic!("started though hung up on") },
                    |_| Ok(a_standing_connection()),
                )
            })
        };
        // Long enough for it to have noted how often the host was hung up on.
        std::thread::sleep(Duration::from_millis(200));

        connections.disconnect("office");
        release.send(()).unwrap();

        assert!(first.join().unwrap().is_err());
        let given_up = second.join().unwrap();
        assert!(given_up.err().unwrap().is(AppErrorCode::ConnectionLost));
        assert!(connections.remote("office").is_err());
    }
}
