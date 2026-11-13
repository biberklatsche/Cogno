//! The hosts this app talks to (`cogno-host`): this machine's daemon, which
//! holds its shells, and those of other machines it is connected to. The
//! commands turn what the webview asks into requests; what a host reports
//! goes back to the webview from here.

mod connections;
mod routes;
mod webview;

use std::net::Shutdown;
use std::process::Command;
use std::sync::Arc;

use cogno_host::protocol::{
    Request, Response, SessionInfo, SessionLifetime, SpawnOptions, TerminalId, TerminalProcess,
    WindowLabel,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::AppHandle;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::host_connection::{HostConnection, Reaching};
use connections::{Connections, Lost};
use routes::{Route, TerminalRoutes};
use webview::{TerminalExit, WebviewEvents};

/// What a start asks for, past the shell itself.
pub struct SpawnRequest {
    pub options: SpawnOptions,
    pub window: WindowLabel,
    pub env: Vec<(String, String)>,
    pub lifetime: SessionLifetime,
    pub on_data: Channel<InvokeResponseBody>,
}

/// What a start did.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spawned {
    pub shell_process_id: Option<u32>,
}

/// Runs `work` on a blocking worker, never on the thread that drives the UI.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> CommandResult<T> + Send + 'static,
) -> CommandResult<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(CommandError::internal)?
}

struct Hosts {
    connections: Connections,
    routes: Arc<TerminalRoutes>,
    events: Arc<WebviewEvents>,
}

impl Hosts {
    /// What runs when the connection `connection` to `host` ends.
    fn on_lost(self: &Arc<Self>, host: Option<String>) -> impl FnOnce(u64) + Send + 'static {
        let hosts = Arc::downgrade(self);
        move |connection| {
            if let Some(hosts) = hosts.upgrade() {
                hosts.lost(host.as_deref(), connection);
            }
        }
    }

    /// The connection to this machine's daemon, which is started if none
    /// runs.
    fn local(self: &Arc<Self>) -> CommandResult<Arc<HostConnection>> {
        self.connections.local(|| {
            let stream = cogno_host::daemon_start::connect_or_start(
                cfg!(debug_assertions),
                env!("CARGO_PKG_VERSION"),
            )
            .map_err(|message| CommandError::new(AppErrorCode::HostNotStarted, message))?;
            let reader = stream.try_clone().map_err(CommandError::internal)?;
            let closer = stream.try_clone().map_err(CommandError::internal)?;
            HostConnection::over(
                reader,
                stream,
                Reaching::ThisMachine,
                self.events.clone(),
                self.on_lost(None),
                // The daemon learns at once that this app is gone, also while
                // a clone of the socket still reads.
                Box::new(move || {
                    let _ = closer.shutdown(Shutdown::Both);
                }),
            )
        })
    }

    /// The connection to `host`, this machine's daemon when `None`.
    fn connection(self: &Arc<Self>, host: Option<&str>) -> CommandResult<Arc<HostConnection>> {
        match host {
            None => self.local(),
            Some(name) => self.connections.remote(name),
        }
    }

    /// The route and the connection of a terminal of `window`.
    fn route(
        self: &Arc<Self>,
        terminal_id: &str,
        window: &str,
    ) -> CommandResult<(Route, Arc<HostConnection>)> {
        let route = self.routes.of_window(terminal_id, window)?;
        let connection = self.connection(route.host.as_deref())?;
        Ok((route, connection))
    }

    /// The connection `connection` to a host ended (`None` is this machine's
    /// daemon): the terminals that came through it end with it. A newer
    /// connection to the same host - it was hung up and set up again - and
    /// its terminals stay.
    fn lost(&self, host: Option<&str>, connection: u64) {
        let lost = self.connections.forget(host, connection);
        for (terminal_id, route) in self.routes.drain_connection(connection) {
            self.events.streams.close(route.stream);
            self.events
                .exit(&route.window, &terminal_id, TerminalExit::ConnectionLost);
        }
        match (lost, host) {
            (Lost::Replaced, _) => {}
            (Lost::HostGone, Some(name)) => self.events.disconnected(name),
            (Lost::HostGone, None) => {
                log::error!(target: "host", "the connection to this machine's host was lost")
            }
        }
    }

    /// The processes under every terminal's shell, on every machine, every
    /// host asked at once: a slow one must not hold up the others.
    fn terminal_processes(&self) -> Vec<TerminalProcess> {
        let connections = self.connections.all();
        std::thread::scope(|scope| {
            let asked: Vec<_> = connections
                .iter()
                .map(|connection| scope.spawn(|| connection.request(Request::TerminalProcesses)))
                .collect();
            asked
                .into_iter()
                // A host that does not answer has no processes to show.
                .filter_map(|answer| match answer.join() {
                    Ok(Ok(Response::TerminalProcesses { processes })) => Some(processes),
                    _ => None,
                })
                .flatten()
                .collect()
        })
    }
}

pub struct HostState(Arc<Hosts>);

impl HostState {
    pub fn new(app: AppHandle) -> Self {
        let routes = Arc::new(TerminalRoutes::default());
        let events = Arc::new(WebviewEvents::new(app, routes.clone()));
        Self(Arc::new(Hosts {
            connections: Connections::default(),
            routes,
            events,
        }))
    }

    /// Connects to the host `name` by starting `command` (ssh), unless the
    /// connection already stands. Returns the host's operating system. Blocks
    /// for as long as the user needs to answer what ssh asks.
    pub fn connect(&self, name: &str, command: Command) -> CommandResult<String> {
        let hosts = &self.0;
        let connection = hosts.connections.connect_remote(name, || {
            HostConnection::connect(
                command,
                Reaching::Remote(name),
                hosts.events.clone(),
                hosts.on_lost(Some(name.to_string())),
            )
        })?;
        Ok(connection.os().to_string())
    }

    /// Starts a shell on this machine for `request.window`.
    pub async fn spawn(&self, request: SpawnRequest) -> CommandResult<Spawned> {
        let hosts = self.0.clone();
        let stream = hosts.events.streams.open(request.on_data);
        let spawned = blocking({
            let hosts = hosts.clone();
            move || {
                let connection = hosts.local()?;
                let terminal_id = request.options.terminal_id.clone();
                let route = hosts.routes.register(
                    &terminal_id,
                    Route {
                        host: None,
                        connection: connection.id(),
                        window: request.window.clone(),
                        stream,
                    },
                );
                let reply = connection.request(Request::PtySpawn {
                    options: request.options,
                    window: request.window,
                    stream,
                    env: request.env,
                    lifetime: request.lifetime,
                })?;
                match reply {
                    Response::Spawned { shell_process_id } => {
                        route.commit();
                        Ok(Spawned { shell_process_id })
                    }
                    Response::ShellAlreadyRuns => Err(CommandError::new(
                        AppErrorCode::ShellAlreadyRuns,
                        format!("A shell already runs under {terminal_id}"),
                    )),
                    _ => Err(CommandError::unexpected_reply()),
                }
            }
        })
        .await;
        if spawned.is_err() {
            // No output will end the stream of a start that did not happen.
            hosts.events.streams.close(stream);
        }
        spawned
    }

    /// Attaches `window` to the shell `terminal_id` that runs on `host` (this
    /// machine when `None`).
    pub async fn attach(
        &self,
        host: Option<String>,
        terminal_id: TerminalId,
        window: WindowLabel,
        on_data: Channel<InvokeResponseBody>,
    ) -> CommandResult<SessionInfo> {
        let hosts = self.0.clone();
        let stream = hosts.events.streams.open(on_data);
        let attached = blocking({
            let hosts = hosts.clone();
            move || {
                let connection = hosts.connection(host.as_deref())?;
                let route = hosts.routes.register(
                    &terminal_id,
                    Route {
                        host,
                        connection: connection.id(),
                        window: window.clone(),
                        stream,
                    },
                );
                match connection.request(Request::PtyAttach {
                    terminal_id,
                    window,
                    stream,
                })? {
                    Response::Attached { session } => {
                        route.commit();
                        Ok(*session)
                    }
                    _ => Err(CommandError::unexpected_reply()),
                }
            }
        })
        .await;
        if attached.is_err() {
            hosts.events.streams.close(stream);
        }
        attached
    }

    /// Asks `host` (this machine when `None`) about itself, not about one
    /// terminal.
    pub async fn request_on(
        &self,
        host: Option<String>,
        request: Request,
    ) -> CommandResult<Response> {
        let hosts = self.0.clone();
        blocking(move || hosts.connection(host.as_deref())?.request(request)).await
    }

    /// Ends the shell `terminal_id` on the host `name`, whether this app
    /// shows it or not. A window of this app that shows it learns that it
    /// ended: the host tells only other clients.
    pub async fn kill_session(&self, name: String, terminal_id: TerminalId) -> CommandResult<()> {
        let shown_here = self.0.routes.remove(&terminal_id);
        let killed = self
            .request_on(
                Some(name),
                Request::PtyKill {
                    terminal_id: terminal_id.clone(),
                },
            )
            .await;
        if let Some(route) = shown_here {
            self.0.events.streams.close(route.stream);
            self.0.events.exit(
                &route.window,
                &terminal_id,
                TerminalExit::KilledByAnotherClient,
            );
        }
        killed.map(|_| ())
    }

    /// Hangs up on the host `name`. Its shells that this app shows end here
    /// (`host-disconnected` follows); whether they run on is theirs to say.
    pub fn disconnect(&self, name: &str) {
        self.0.connections.disconnect(name);
    }

    /// For requests about one terminal that need no answer (what is typed,
    /// resized, placed): queued, so the calling thread is never held up.
    pub fn post(&self, window: &str, request: Request) -> CommandResult<()> {
        let terminal_id = terminal_of(&request)?;
        let (_, connection) = self.0.route(terminal_id, window)?;
        connection.post(request)
    }

    /// The webview took in every chunk of the terminal's output up to and
    /// including `chunk`: the host hears of it once that completes a piece
    /// it sent.
    pub fn acknowledge(
        &self,
        window: &str,
        terminal_id: TerminalId,
        chunk: u32,
    ) -> CommandResult<()> {
        let (route, connection) = self.0.route(&terminal_id, window)?;
        match self.0.events.streams.acknowledged(route.stream, chunk) {
            Some(seq) => connection.post(Request::PtyAck { terminal_id, seq }),
            None => Ok(()),
        }
    }

    /// Asks about a terminal of `window` and waits for the answer on a
    /// blocking worker. A terminal that is killed or let go is no longer
    /// this app's afterwards, whatever the answer.
    pub async fn request(&self, window: WindowLabel, request: Request) -> CommandResult<Response> {
        let hosts = self.0.clone();
        blocking(move || {
            let terminal_id = terminal_of(&request)?.to_string();
            let (_, connection) = hosts.route(&terminal_id, &window)?;
            let gone = matches!(request, Request::PtyKill { .. } | Request::PtyDetach { .. });
            let reply = connection.request(request);
            if gone {
                hosts.routes.remove(&terminal_id);
            }
            reply
        })
        .await
    }

    /// The processes under every terminal's shell, on every machine.
    pub async fn terminal_processes(&self) -> CommandResult<Vec<TerminalProcess>> {
        let hosts = self.0.clone();
        blocking(move || Ok(hosts.terminal_processes())).await
    }

    /// The window that spawned or attached the terminal: where its messages go.
    pub fn window_of(&self, terminal_id: &str) -> Option<WindowLabel> {
        self.0.routes.window_of(terminal_id)
    }

    /// The window is gone: its shells end, on every machine, except those
    /// that survive their window. Returns at once.
    pub fn window_closed(&self, window: &str) {
        for route in self.0.routes.drain_window(window) {
            self.0.events.streams.close(route.stream);
        }
        for connection in self.0.connections.all() {
            // Every host is told, also one without a terminal of this
            // window: a start may still be on its way there.
            let _ = connection.post(Request::WindowClosed {
                window: window.to_string(),
            });
        }
    }

    /// Hangs up on every host: what the app does on its way out. A host ends
    /// the shells that were not started to go on without their client.
    pub fn hang_up_all(&self) {
        self.0.connections.clear();
    }
}

/// The terminal a request is about. Every request this app sends through a
/// terminal's route names one.
fn terminal_of(request: &Request) -> CommandResult<&str> {
    request.terminal_id().ok_or_else(|| {
        CommandError::internal("A request about no terminal took a terminal's route")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_request_about_no_terminal_has_no_route() {
        assert!(terminal_of(&Request::ListShells).is_err());
        assert_eq!(
            terminal_of(&Request::PtyKill {
                terminal_id: "t1".to_string()
            })
            .unwrap(),
            "t1"
        );
    }
}
