//! The connections this app holds: one to this machine's daemon, and one to
//! each host on another machine it is connected to.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use cogno_host::sync::lock;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::{HangUp, HostConnection, Underway};

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
    /// The connects to other machines, by the host's name.
    attempts: Mutex<HashMap<String, Attempt>>,
}

/// How a host's connects are given up: hanging up on the host counts up,
/// and a connect that sees the count change - while it waits for its turn,
/// between two commands, or once its process answered - gives up.
#[derive(Default)]
struct Attempt {
    hang_ups: u64,
    /// Ends the process of the connect in progress.
    ender: Option<HangUp>,
}

/// A connection to another machine, and which of the commands tried reached
/// it: `None` when it already stood.
pub struct Connected {
    pub connection: Arc<HostConnection>,
    pub by: Option<usize>,
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

    fn hang_ups_of(&self, name: &str) -> u64 {
        lock(&self.attempts)
            .entry(name.to_string())
            .or_default()
            .hang_ups
    }

    /// What ends the process of the connect to `name` in progress.
    fn set_ender(&self, name: &str, ender: Option<HangUp>) {
        lock(&self.attempts)
            .entry(name.to_string())
            .or_default()
            .ender = ender;
    }

    /// The connection to the host `name`, unless one stands: `start` starts
    /// the process of each of `commands` in turn, as long as the one before
    /// did not reach Cogno (`NoCognoThere`), and `introduce` waits for the
    /// host there. Hanging up on `name` meanwhile gives up on it - also while
    /// it waits for its turn.
    pub fn connect_remote<U: Underway>(
        &self,
        name: &str,
        commands: &[String],
        mut start: impl FnMut(&str) -> CommandResult<U>,
        mut introduce: impl FnMut(U) -> CommandResult<HostConnection>,
    ) -> CommandResult<Connected> {
        let hang_ups = self.hang_ups_of(name);
        let given_up = || self.hang_ups_of(name) != hang_ups;
        let _one_at_a_time = lock(&self.connecting_remote);
        if let Ok(connection) = self.remote(name) {
            return Ok(Connected {
                connection,
                by: None,
            });
        }
        let mut first_failure: Option<CommandError> = None;
        for (index, command) in commands.iter().enumerate() {
            if given_up() {
                return Err(hung_up_on(name));
            }
            let starting = start(command)?;
            self.set_ender(name, Some(starting.ender()));
            // Hung up on before the ender was there to be called.
            if given_up() {
                self.set_ender(name, None);
                (starting.ender())();
                return Err(hung_up_on(name));
            }
            let introduced = introduce(starting);
            self.set_ender(name, None);
            if given_up() {
                if let Ok(connection) = introduced {
                    connection.hang_up();
                }
                return Err(hung_up_on(name));
            }
            match introduced {
                Ok(connection) => {
                    return self
                        .put_in_place(name, connection)
                        .map(|connection| Connected {
                            connection,
                            by: Some(index),
                        })
                }
                // The command did not reach Cogno: the next one may.
                Err(error) if error.is(AppErrorCode::NoCognoThere) => {
                    first_failure.get_or_insert(error);
                }
                Err(error) => return Err(error),
            }
        }
        // What the first command met says the most.
        Err(first_failure.unwrap_or_else(|| CommandError::internal("No command to try")))
    }

    fn put_in_place(
        &self,
        name: &str,
        connection: HostConnection,
    ) -> CommandResult<Arc<HostConnection>> {
        let connection = Arc::new(connection);
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

    /// Gives up the connects to the hosts `which` names; the processes of
    /// those in progress end.
    fn give_up(&self, which: impl Fn(&str) -> bool) {
        let enders: Vec<HangUp> = lock(&self.attempts)
            .iter_mut()
            .filter(|(name, _)| which(name))
            .filter_map(|(_, attempt)| {
                attempt.hang_ups += 1;
                attempt.ender.take()
            })
            .collect();
        for end in enders {
            end();
        }
    }

    /// Hangs up on the host `name`, and gives up on a connection to it that
    /// is being set up or waits to be.
    pub fn disconnect(&self, name: &str) {
        let standing = lock(&self.remotes).remove(name);
        if let Some(connection) = standing {
            connection.hang_up();
        }
        self.give_up(|host| host == name);
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

fn hung_up_on(name: &str) -> CommandError {
    CommandError::new(
        AppErrorCode::ConnectionLost,
        format!("The connection to {name} was hung up"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host_connection::test_support::{a_standing_connection, failing_process};
    use crate::host_connection::Starting;
    use std::sync::mpsc;
    use std::time::Duration;

    fn not_cogno() -> CommandError {
        CommandError::new(AppErrorCode::NoCognoThere, "cogno: not found")
    }

    #[test]
    fn a_command_that_does_not_reach_cogno_is_followed_by_the_next() {
        let connections = Connections::default();
        let mut tried = 0;

        let connected = connections
            .connect_remote(
                "office",
                &["sh".to_string(), "pwsh".to_string()],
                |_| Starting::spawn(failing_process("", 0)),
                |_| {
                    tried += 1;
                    if tried == 1 {
                        Err(not_cogno())
                    } else {
                        Ok(a_standing_connection())
                    }
                },
            )
            .unwrap();

        assert_eq!(connected.by, Some(1));
        assert!(connections.remote("office").is_ok());
    }

    #[test]
    fn a_hang_up_while_the_process_starts_ends_it_before_anything_waits_for_it() {
        let connections = Connections::default();
        let mut introduced = false;

        let given_up = connections.connect_remote(
            "office",
            &["sh".to_string()],
            |_| {
                // Hung up on before its ender was stored.
                connections.disconnect("office");
                Starting::spawn(failing_process("", 0))
            },
            |_| {
                introduced = true;
                Ok(a_standing_connection())
            },
        );

        assert!(given_up.err().unwrap().is(AppErrorCode::ConnectionLost));
        assert!(!introduced);
    }

    #[test]
    fn any_other_failure_ends_the_trying() {
        let connections = Connections::default();
        let mut tried = 0;

        let failed = connections.connect_remote(
            "office",
            &["sh".to_string(), "pwsh".to_string()],
            |_| Starting::spawn(failing_process("", 0)),
            |_| {
                tried += 1;
                Err(CommandError::new(AppErrorCode::ConnectFailed, "denied"))
            },
        );

        assert!(failed.err().unwrap().is(AppErrorCode::ConnectFailed));
        assert_eq!(tried, 1);
    }

    #[test]
    fn a_connect_that_waits_for_its_turn_is_given_up_when_hung_up_on() {
        let connections = Arc::new(Connections::default());
        let (release, released) = mpsc::channel::<()>();
        let (entered, entering) = mpsc::channel::<()>();
        // Another host takes its time: asked for a password, say.
        let first = {
            let connections = connections.clone();
            std::thread::spawn(move || {
                connections.connect_remote(
                    "home",
                    &["sh".to_string()],
                    |_| Starting::spawn(failing_process("", 0)),
                    |_| {
                        entered.send(()).unwrap();
                        released.recv().unwrap();
                        Ok(a_standing_connection())
                    },
                )
            })
        };
        entering.recv().unwrap();
        let second = {
            let connections = connections.clone();
            std::thread::spawn(move || {
                connections.connect_remote(
                    "office",
                    &["sh".to_string()],
                    |_| -> CommandResult<Starting> { panic!("started though hung up on") },
                    |_| Ok(a_standing_connection()),
                )
            })
        };
        // Waits for its turn once it noted how often the host was hung up on.
        let started = std::time::Instant::now();
        while !lock(&connections.attempts).contains_key("office") {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "it never asked"
            );
            std::thread::yield_now();
        }

        connections.disconnect("office");
        release.send(()).unwrap();

        assert!(first.join().unwrap().is_ok());
        let given_up = second.join().unwrap();
        assert!(given_up.err().unwrap().is(AppErrorCode::ConnectionLost));
        assert!(connections.remote("office").is_err());
    }
}
