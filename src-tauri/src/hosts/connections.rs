//! The connections this app holds: one to this machine's host, and one to
//! each host on another machine it is connected to.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::{HangUp, HostConnection};

/// How far the connection to a machine is, for every window to show; a
/// machine without one is not connected.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum RemoteState {
    Connecting,
    Connected {
        /// "windows", "macos" or "linux".
        os: String,
    },
    Failed {
        failure: CommandError,
    },
}

#[derive(Default)]
pub struct Connections {
    /// Told whenever a machine's `RemoteState` changed.
    on_change: Option<Box<dyn Fn() + Send + Sync>>,
    /// The connection to this machine's host, once there was one.
    local: Mutex<Option<Arc<HostConnection>>>,
    /// The connections to other machines, by the id they are paired under.
    remotes: Mutex<HashMap<String, Arc<HostConnection>>>,
    /// The same for this machine's host, apart from the other machines: one
    /// that does not answer must not hold up the terminals here.
    connecting_local: Mutex<()>,
    /// The connects to other machines, by the host's id.
    attempts: Mutex<HashMap<String, Attempt>>,
}

/// How a host's connects are given up: hanging up on the host counts up,
/// and a connect that sees the count change - while it waits for its turn,
/// or once the host answered - gives up.
#[derive(Default)]
struct Attempt {
    /// Held while a connection to the host is set up: two panes of one host
    /// restored together share a connection instead of each starting one.
    /// A turn per machine: one that is not reached holds up no other.
    turn: Arc<Mutex<()>>,
    hang_ups: u64,
    /// Ends the connect in progress.
    ender: Option<HangUp>,
    /// How far the connection is, as the windows show it.
    state: Option<RemoteState>,
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
    /// Connections whose remote states `on_change` hears change.
    pub fn telling(on_change: impl Fn() + Send + Sync + 'static) -> Self {
        Self {
            on_change: Some(Box::new(on_change)),
            ..Self::default()
        }
    }

    /// How far the connection to each machine is, by its id.
    pub fn states(&self) -> HashMap<String, RemoteState> {
        lock(&self.attempts)
            .iter()
            .filter_map(|(id, attempt)| Some((id.clone(), attempt.state.clone()?)))
            .collect()
    }

    /// Changes the state of the hosts `which` names as `change` says, and
    /// tells of it when that changed one.
    fn change_states(&self, which: impl Fn(&str) -> bool, change: impl Fn(&mut Attempt)) {
        let changed = lock(&self.attempts)
            .iter_mut()
            .filter(|(id, _)| which(id))
            .fold(false, |changed, (_, attempt)| {
                let before = attempt.state.clone();
                change(attempt);
                changed || attempt.state != before
            });
        if changed {
            if let Some(on_change) = &self.on_change {
                on_change();
            }
        }
    }

    /// A connect to `id` sets out: how often the host was hung up on so far.
    fn begin(&self, id: &str) -> u64 {
        lock(&self.attempts).entry(id.to_string()).or_default();
        self.change_states(
            |host| host == id,
            |attempt| {
                if !matches!(attempt.state, Some(RemoteState::Connected { .. })) {
                    attempt.state = Some(RemoteState::Connecting);
                }
            },
        );
        self.hang_ups_of(id)
    }

    /// The connection to `id` broke: said so until it is connected again.
    pub fn lost_remote(&self, id: &str) {
        self.change_states(
            |host| host == id,
            |attempt| {
                if matches!(attempt.state, Some(RemoteState::Connected { .. })) {
                    attempt.state = Some(RemoteState::Failed {
                        failure: CommandError::connection_lost(),
                    });
                }
            },
        );
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
            .filter(|remote| !remote.is_lost())
            .cloned()
            .ok_or_else(|| {
                CommandError::new(AppErrorCode::NotConnected, "Not connected to that machine")
            })
    }

    /// The connection `id` to `host` (`None` is this machine's), while
    /// it stands: never another one, and never one set up for the asking.
    pub fn current(&self, host: Option<&str>, id: u64) -> CommandResult<Arc<HostConnection>> {
        let connection = match host {
            None => lock(&self.local).clone(),
            Some(id) => lock(&self.remotes).get(id).cloned(),
        };
        connection
            .filter(|connection| connection.id() == id && !connection.is_lost())
            .ok_or_else(CommandError::connection_lost)
    }

    fn hang_ups_of(&self, id: &str) -> u64 {
        lock(&self.attempts)
            .entry(id.to_string())
            .or_default()
            .hang_ups
    }

    /// What ends the connect to `id` in progress; what did before.
    fn set_ender(&self, id: &str, ender: Option<HangUp>) -> Option<HangUp> {
        std::mem::replace(
            &mut lock(&self.attempts)
                .entry(id.to_string())
                .or_default()
                .ender,
            ender,
        )
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
        let hang_ups = self.begin(id);
        let connected = self.connect_in_turn(id, hang_ups, start, introduce);
        // Hung up on meanwhile: what came of this connect is no news.
        self.change_states(
            |host| host == id,
            |attempt| {
                if attempt.hang_ups != hang_ups {
                    return;
                }
                attempt.state = Some(match &connected {
                    Ok(connection) => RemoteState::Connected {
                        os: connection.os().to_string(),
                    },
                    Err(failure) => RemoteState::Failed {
                        failure: failure.clone(),
                    },
                });
            },
        );
        connected
    }

    fn connect_in_turn<U>(
        &self,
        id: &str,
        hang_ups: u64,
        start: impl FnOnce() -> CommandResult<(U, HangUp)>,
        introduce: impl FnOnce(U) -> CommandResult<HostConnection>,
    ) -> CommandResult<Arc<HostConnection>> {
        let given_up = || self.hang_ups_of(id) != hang_ups;
        let turn = lock(&self.attempts)
            .entry(id.to_string())
            .or_default()
            .turn
            .clone();
        let _one_at_a_time = lock(&turn);
        if let Ok(connection) = self.remote(id) {
            return Ok(connection);
        }
        if given_up() {
            return Err(hung_up());
        }
        let (starting, ender) = start()?;
        self.set_ender(id, Some(ender));
        // Hung up on before the ender was there to be called.
        if given_up() {
            if let Some(ender) = self.set_ender(id, None) {
                ender();
            }
            return Err(hung_up());
        }
        let introduced = introduce(starting);
        self.set_ender(id, None);
        if given_up() {
            if let Ok(connection) = introduced {
                connection.hang_up();
            }
            return Err(hung_up());
        }
        self.put_in_place(id, introduced?)
    }

    fn put_in_place(
        &self,
        id: &str,
        connection: HostConnection,
    ) -> CommandResult<Arc<HostConnection>> {
        let connection = Arc::new(connection);
        lock(&self.remotes).insert(id.to_string(), connection.clone());
        // Lost before it was put in its place: its end found nothing to take
        // out, so it is taken out here.
        if connection.is_lost() {
            lock(&self.remotes).remove(id);
            return Err(CommandError::connection_lost());
        }
        Ok(connection)
    }

    /// The connection `connection` to `host` ended (`None` is this
    /// machine's): taken out if it is the host's current one.
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
            Some(id) => {
                let mut remotes = lock(&self.remotes);
                if is_it(remotes.get(id)) {
                    remotes.remove(id);
                    return Lost::HostGone;
                }
                // Not in the map at all: it was hung up on.
                if remotes.contains_key(id) {
                    Lost::Replaced
                } else {
                    Lost::HostGone
                }
            }
        }
    }

    /// Gives up the connects to the hosts `which` names; those in progress
    /// end, and the hosts are not connected.
    fn give_up(&self, which: impl Fn(&str) -> bool) {
        let enders: Vec<HangUp> = lock(&self.attempts)
            .iter_mut()
            .filter(|(id, _)| which(id))
            .filter_map(|(_, attempt)| {
                attempt.hang_ups += 1;
                attempt.ender.take()
            })
            .collect();
        for end in enders {
            end();
        }
        self.change_states(which, |attempt| attempt.state = None);
    }

    /// Hangs up on the host `id`, and gives up on a connection to it that
    /// is being set up or waits to be.
    pub fn disconnect(&self, id: &str) {
        let standing = lock(&self.remotes).remove(id);
        if let Some(connection) = standing {
            connection.hang_up();
        }
        self.give_up(|host| host == id);
    }

    /// Every connection that stands, this machine's included.
    pub fn all(&self) -> Vec<Arc<HostConnection>> {
        let mut connections: Vec<Arc<HostConnection>> =
            lock(&self.remotes).values().cloned().collect();
        connections.extend(lock(&self.local).clone());
        connections
    }

    /// Hangs up on every host, and gives up on every connection being set
    /// up or waiting to be.
    pub fn clear(&self) {
        let remotes: Vec<_> = lock(&self.remotes).drain().map(|(_, c)| c).collect();
        let local = lock(&self.local).take();
        for connection in remotes.into_iter().chain(local) {
            connection.hang_up();
        }
        self.give_up(|_| true);
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
        let connections = Connections::default();
        let connect = || {
            connections.connect_remote("office", || Ok(setting()), |_| Ok(a_standing_connection()))
        };

        let first = connect().unwrap();
        let second = connect().unwrap();

        assert_eq!(first.id(), second.id());
    }

    #[test]
    fn a_hang_up_while_the_connect_starts_ends_it_before_anything_waits_for_it() {
        let connections = Connections::default();
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
        let connections = Connections::default();

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
        let os = connected.os().to_string();
        assert_eq!(state("office"), Some(RemoteState::Connected { os }));
        // Connecting, failed, connecting, connected.
        assert_eq!(told.load(Ordering::SeqCst), 4);

        // Asked for again while it stands: nothing changes.
        connections
            .connect_remote("office", || Ok(setting()), |_| Ok(a_standing_connection()))
            .unwrap();
        assert_eq!(told.load(Ordering::SeqCst), 4);

        connections.lost_remote("office");
        assert!(matches!(state("office"), Some(RemoteState::Failed { .. })));

        connections.disconnect("office");
        assert_eq!(state("office"), None);
        assert_eq!(told.load(Ordering::SeqCst), 6);
    }

    #[test]
    fn a_connect_that_was_hung_up_on_leaves_the_host_not_connected() {
        let connections = Connections::default();

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
        let connections = Arc::new(Connections::default());
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
