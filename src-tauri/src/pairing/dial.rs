//! Connecting to a paired machine (`cogno/host/1`, ARCHITECTURE.md 2.7.3):
//! the other machine's app accepts, checks that this one is paired, opens
//! the stream and hands it to its host, which speaks first. Here the
//! stream becomes a `HostConnection`.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use cogno_host::sync::lock;
use iroh::endpoint::{ApplicationClose, Connection, ConnectionError, RecvStream, SendStream};
use iroh::{Endpoint, EndpointAddr, EndpointId};
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
}

type Streams = (SendStream, RecvStream);

/// A dial on its way: the connection, once there, and the task that makes it.
pub struct Dialing {
    /// What the user calls the machine, for what failures say.
    name: String,
    task: JoinHandle<Result<Streams, CommandError>>,
    connection: Arc<Mutex<Option<Connection>>>,
}

impl Dialing {
    /// Dials the paired machine `id`, found in the local network; the user
    /// knows it as `name`.
    pub fn start(endpoint: Endpoint, id: EndpointId, name: &str) -> Self {
        let connection = Arc::new(Mutex::new(None));
        let made = connection.clone();
        let dialed = name.to_string();
        let name = dialed.clone();
        let task = tokio::spawn(async move {
            let dialing = async {
                let opened = endpoint
                    .connect(EndpointAddr::new(id), HOST_ALPN)
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
        Self {
            name: dialed,
            task,
            connection,
        }
    }

    /// Waits for the host there to introduce itself. On a blocking thread.
    pub fn introduce(
        self,
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
        HostConnection::over(reader, writer, Some(&self.name), events, on_lost, ender)
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
        format!("Could not reach {name}: Cogno must run there, in the same network ({reason})"),
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
        _ => unreachable(name, error),
    }
}
