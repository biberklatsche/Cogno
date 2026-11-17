//! Connecting to a paired machine (`cogno/host/1`, ARCHITECTURE.md 2.7.3):
//! the other machine's app accepts, checks that this one is paired, opens
//! the stream and passes it to its daemon, which speaks first. Here the
//! stream becomes a `HostConnection` like one over ssh.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use cogno_host::sync::lock;
use iroh::endpoint::{ApplicationClose, Connection, ConnectionError, RecvStream, SendStream};
use iroh::{Endpoint, EndpointAddr};
use tokio::task::JoinHandle;
use tokio_util::io::SyncIoBridge;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::{HangUp, HostConnection, HostEvents, OnLost, Underway};

pub const HOST_ALPN: &[u8] = b"cogno/host/1";

/// How long reaching a paired machine may take.
const DIAL_PATIENCE: Duration = Duration::from_secs(20);

/// Why the accepting machine closed the connection at once.
pub mod refusal {
    /// This machine is not paired with it (any more).
    pub const NOT_PAIRED: u32 = 1;
    /// It does not accept connections now.
    pub const NOT_ACCEPTING: u32 = 2;
    /// Its daemon does not run.
    pub const NO_DAEMON: u32 = 3;
}

type Streams = (SendStream, RecvStream);

/// A dial on its way: the connection, once there, and the task that makes it.
pub struct Dialing {
    task: JoinHandle<Result<Streams, CommandError>>,
    connection: Arc<Mutex<Option<Connection>>>,
}

impl Dialing {
    pub fn start(endpoint: Endpoint, to: EndpointAddr, name: &str) -> Self {
        let connection = Arc::new(Mutex::new(None));
        let made = connection.clone();
        let name = name.to_string();
        let task = tokio::spawn(async move {
            let dialing = async {
                let opened = endpoint
                    .connect(to, HOST_ALPN)
                    .await
                    .map_err(|error| unreachable(&name, &error))?;
                *lock(&made) = Some(opened.clone());
                // The host speaks first: the other side opens the stream.
                opened
                    .accept_bi()
                    .await
                    .map_err(|error| refused(&name, &error))
            };
            tokio::time::timeout(DIAL_PATIENCE, dialing)
                .await
                .map_err(|_| unreachable(&name, &"no answer in time"))?
        });
        Self { task, connection }
    }

    /// Waits for the host there to introduce itself. On a blocking thread.
    pub fn introduce(
        self,
        name: &str,
        events: Arc<dyn HostEvents>,
        on_lost: OnLost,
    ) -> CommandResult<HostConnection> {
        let runtime = tokio::runtime::Handle::current();
        let ender = self.ender();
        let (send, recv) = runtime
            .block_on(self.task)
            .map_err(|_| CommandError::connection_lost())??;
        let reader = SyncIoBridge::new_with_handle(recv, runtime.clone());
        let writer = SyncIoBridge::new_with_handle(send, runtime);
        HostConnection::to_paired_machine(reader, writer, name, events, on_lost, ender)
    }
}

impl Underway for Dialing {
    fn ender(&self) -> HangUp {
        let task = self.task.abort_handle();
        let connection = self.connection.clone();
        Box::new(move || {
            task.abort();
            if let Some(connection) = lock(&connection).take() {
                connection.close(0u32.into(), b"hung up");
            }
        })
    }
}

fn unreachable(name: &str, reason: &dyn std::fmt::Display) -> CommandError {
    CommandError::new(
        AppErrorCode::ConnectFailed,
        format!("Could not reach {name}: Cogno must run there with connections on ({reason})"),
    )
}

/// What the accepting machine's close says.
fn refused(name: &str, error: &ConnectionError) -> CommandError {
    let ConnectionError::ApplicationClosed(ApplicationClose { error_code, .. }) = error else {
        return unreachable(name, error);
    };
    match u32::try_from(u64::from(*error_code)) {
        Ok(refusal::NOT_PAIRED) => CommandError::new(
            AppErrorCode::NotPaired,
            format!("{name} is not paired with this machine any more"),
        ),
        Ok(refusal::NOT_ACCEPTING) => CommandError::new(
            AppErrorCode::ConnectFailed,
            format!("{name} does not accept connections now"),
        ),
        Ok(refusal::NO_DAEMON) => CommandError::new(
            AppErrorCode::CognoNotRunning,
            format!("Cogno's shells do not run on {name}"),
        ),
        _ => unreachable(name, error),
    }
}
