//! The hosts this app talks to (`cogno-host`): this machine's, which the app
//! runs itself and which holds its shells, and those of the paired machines
//! it is connected to. The commands turn what the webview asks into
//! requests; what a host reports goes back to the webview from here.

mod connections;
mod questions;
mod routes;
mod webview;

use std::sync::Arc;
use std::time::Duration;

use cogno_host::local_host::LocalHost;
use cogno_host::protocol::{
    HostErrorCode, Request, Response, SessionInfo, SpawnOptions, StreamId, TerminalId,
    TerminalProcess, WindowLabel,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, Manager};

use crate::command_error::{AppErrorCode, CommandError, CommandResult, ErrorCode};
use crate::host_connection::{Ending, HostConnection, OnLost};
use connections::Connections;
pub use connections::RemoteState;
use routes::{Route, TerminalRoutes};
use webview::{TerminalExit, WebviewEvents};

/// What a start did.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spawned {
    pub shell_process_id: Option<u32>,
}

/// How long a host is given to say which processes run under its shells: the
/// ones that answer are shown without waiting for one that does not.
const PROCESSES_PATIENCE: Duration = Duration::from_secs(2);

/// Runs `work` on a blocking worker, never on the thread that drives the UI.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> CommandResult<T> + Send + 'static,
) -> CommandResult<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(CommandError::internal)?
}

struct Hosts {
    /// This machine's host, or why it could not be opened.
    local_host: Result<Arc<LocalHost>, String>,
    connections: Connections,
    routes: Arc<TerminalRoutes>,
    events: Arc<WebviewEvents>,
}

impl Hosts {
    /// What runs when a connection to `host` ends.
    fn on_lost(self: &Arc<Self>, host: Option<String>) -> OnLost {
        let hosts = Arc::downgrade(self);
        Box::new(move |connection, ending| {
            if let Some(hosts) = hosts.upgrade() {
                hosts.lost(host.as_deref(), connection, ending);
            }
        })
    }

    /// The connection to this machine's host.
    fn local(self: &Arc<Self>) -> CommandResult<Arc<HostConnection>> {
        self.connections.local(|| {
            let not_started =
                |reason: String| CommandError::new(AppErrorCode::HostNotStarted, reason);
            self.local_host.clone().map_err(not_started)?;
            let endpoint = crate::host_endpoint::own_host_endpoint().map_err(not_started)?;
            let stream = cogno_host::local_host::connect(&endpoint)
                .map_err(|error| not_started(error.to_string()))?;
            HostConnection::to_this_machine(stream, self.events.clone(), self.on_lost(None))
        })
    }

    /// The connection to `host`, this machine's when `None`.
    fn connection(self: &Arc<Self>, host: Option<&str>) -> CommandResult<Arc<HostConnection>> {
        match host {
            None => self.local(),
            Some(name) => self.connections.remote(name),
        }
    }

    /// The route of a terminal of `window`, and the connection it came
    /// through - never another one, and never one set up for the asking: what
    /// is typed into a terminal whose connection is gone goes nowhere.
    fn route(
        &self,
        terminal_id: &str,
        window: &str,
    ) -> CommandResult<(Route, Arc<HostConnection>)> {
        let route = self.routes.of_window(terminal_id, window)?;
        let connection = self
            .connections
            .current(route.host.as_deref(), route.connection)?;
        Ok((route, connection))
    }

    /// The connection `connection` to a host ended (`None` is this
    /// machine's): the terminals that came through it end with it. A newer
    /// connection to the same host - it was hung up and set up again - and
    /// its terminals stay.
    fn lost(&self, host: Option<&str>, connection: u64, ending: Ending) {
        let was_current = self.connections.ended(host, connection, ending);
        let exit = match ending {
            Ending::HungUp => TerminalExit::HungUp,
            Ending::Lost => TerminalExit::ConnectionLost,
        };
        for (terminal_id, route) in self.routes.drain_connection(connection) {
            self.events.streams.close(route.stream);
            self.events.exit(&route.window, &terminal_id, exit);
        }
        if host.is_none() && was_current && ending == Ending::Lost {
            log::error!(target: "host", "the connection to this machine's host was lost");
        }
    }

    /// The processes under every terminal's shell, on every machine, every
    /// host asked at once: a slow one must not hold up the others, and one
    /// that does not answer in time has none to show.
    fn terminal_processes(&self) -> Vec<TerminalProcess> {
        let connections = self.connections.all();
        std::thread::scope(|scope| {
            let asked: Vec<_> = connections
                .iter()
                .map(|connection| {
                    scope.spawn(|| {
                        connection.request_within(Request::TerminalProcesses, PROCESSES_PATIENCE)
                    })
                })
                .collect();
            asked
                .into_iter()
                .filter_map(|answer| match answer.join() {
                    Ok(Some(Ok(Response::TerminalProcesses { processes }))) => Some(processes),
                    _ => None,
                })
                .flatten()
                .collect()
        })
    }

    /// Opens the output stream of the terminal `terminal_id` of `window` on
    /// `host` (this machine when `None`) and asks the host for it: `ask`
    /// makes the request for the stream, `accept` reads the answer. The
    /// route stands from before the request - output may come first - and
    /// stays only when the answer is taken.
    async fn open_terminal<T: Send + 'static>(
        self: &Arc<Self>,
        host: Option<String>,
        terminal_id: TerminalId,
        window: WindowLabel,
        on_data: Channel<InvokeResponseBody>,
        ask: impl FnOnce(StreamId) -> Request + Send + 'static,
        accept: impl FnOnce(&TerminalId, Response) -> CommandResult<T> + Send + 'static,
    ) -> CommandResult<T> {
        let stream = self.events.streams.open(on_data);
        let opened = blocking({
            let hosts = self.clone();
            move || {
                let connection = hosts.connection(host.as_deref())?;
                let route = hosts.routes.register(
                    &terminal_id,
                    Route {
                        host,
                        connection: connection.id(),
                        window,
                        stream,
                    },
                );
                let opened = accept(&terminal_id, connection.request(ask(stream))?)?;
                route.commit();
                Ok(opened)
            }
        })
        .await;
        if opened.is_err() {
            // No output will end the stream of a terminal that did not open.
            self.events.streams.close(stream);
        }
        opened
    }
}

pub struct HostState(Arc<Hosts>);

impl HostState {
    /// Opens this machine's host. Call after `shell_bootstrap_logs::manage`:
    /// the host takes that folder for its shells' start-up logs.
    pub fn new(app: AppHandle) -> Self {
        let bootstrap_log_dir = app
            .state::<crate::shell_bootstrap_logs::ShellBootstrapLogDir>()
            .0
            .clone();
        let local_host = open_local_host(bootstrap_log_dir);
        if let Err(reason) = &local_host {
            log::error!(target: "host", "this machine's host could not be opened: {reason}");
        }
        let routes = Arc::new(TerminalRoutes::default());
        let events = Arc::new(WebviewEvents::new(app.clone(), routes.clone()));
        let connections = Connections::telling(move || {
            let _ = app.emit(webview::HOST_CONNECTIONS_CHANGED_EVENT, ());
        });
        Self(Arc::new(Hosts {
            local_host,
            connections,
            routes,
            events,
        }))
    }

    /// How far the connection to each machine is, by its id: the same for
    /// every window.
    pub fn remote_states(&self) -> std::collections::HashMap<String, RemoteState> {
        self.0.connections.states()
    }

    /// Connects to the paired machine `id` (ARCHITECTURE.md 2.7.3), unless
    /// the connection already stands.
    pub fn connect(
        &self,
        id: &str,
        pairing: &crate::pairing::Pairing,
    ) -> CommandResult<Arc<HostConnection>> {
        let hosts = &self.0;
        hosts.connections.connect_remote(
            id,
            || {
                let dialing = pairing.dial(id)?;
                let ender = dialing.ender();
                Ok((dialing, ender))
            },
            |dialing| dialing.introduce(hosts.events.clone(), hosts.on_lost(Some(id.to_string()))),
        )
    }

    /// Starts a shell on this machine for `window`.
    pub async fn spawn(
        &self,
        options: SpawnOptions,
        window: WindowLabel,
        on_data: Channel<InvokeResponseBody>,
    ) -> CommandResult<Spawned> {
        let terminal_id = options.terminal_id.clone();
        self.0
            .open_terminal(
                None,
                terminal_id,
                window.clone(),
                on_data,
                move |stream| Request::PtySpawn {
                    options,
                    window,
                    stream,
                },
                |terminal_id, reply| match reply {
                    Response::Spawned { shell_process_id } => Ok(Spawned { shell_process_id }),
                    Response::ShellAlreadyRuns => Err(CommandError::new(
                        AppErrorCode::ShellAlreadyRuns,
                        format!("A shell already runs under {terminal_id}"),
                    )),
                    _ => Err(CommandError::unexpected_reply()),
                },
            )
            .await
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
        let asked_for = terminal_id.clone();
        self.0
            .open_terminal(
                host,
                terminal_id,
                window.clone(),
                on_data,
                move |stream| Request::PtyAttach {
                    terminal_id: asked_for,
                    window,
                    stream,
                },
                |_, reply| match reply {
                    Response::Attached { session } => Ok(*session),
                    _ => Err(CommandError::unexpected_reply()),
                },
            )
            .await
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
    /// ended - the host tells only other clients - once it did.
    pub async fn kill_session(&self, name: String, terminal_id: TerminalId) -> CommandResult<()> {
        let killed = self
            .request_on(
                Some(name),
                Request::PtyKill {
                    terminal_id: terminal_id.clone(),
                },
            )
            .await;
        let ended = match &killed {
            Ok(_) => true,
            Err(error) => error.code == ErrorCode::Host(HostErrorCode::SessionNotFound),
        };
        if ended {
            if let Some(route) = self.0.routes.remove(&terminal_id) {
                self.0.events.streams.close(route.stream);
                self.0.events.exit(
                    &route.window,
                    &terminal_id,
                    TerminalExit::KilledByAnotherClient,
                );
            }
        }
        killed.map(|_| ())
    }

    /// Hangs up on the host `name`, or gives up connecting to it. Its shells
    /// that this app shows end here, as hung up on; they run on there.
    pub async fn disconnect(&self, name: String) {
        let hosts = self.0.clone();
        // Hanging up may wait: not on the thread of the UI.
        let _ = blocking(move || {
            hosts.connections.disconnect(&name);
            Ok(())
        })
        .await;
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
        channel: u32,
        chunk: u32,
    ) -> CommandResult<()> {
        let (route, connection) = self.0.route(&terminal_id, window)?;
        match self
            .0
            .events
            .streams
            .acknowledged(route.stream, channel, chunk)
        {
            Some(seq) => connection.post(Request::PtyAck {
                terminal_id,
                stream: route.stream,
                seq,
            }),
            None => Ok(()),
        }
    }

    /// Asks about a terminal of `window` and waits for the answer on a
    /// blocking worker. A terminal that is killed or let go is no longer
    /// this window's afterwards, whatever the answer; another window of this
    /// app that showed it meanwhile keeps its route.
    pub async fn request(&self, window: WindowLabel, request: Request) -> CommandResult<Response> {
        let hosts = self.0.clone();
        blocking(move || {
            let terminal_id = terminal_of(&request)?.to_string();
            let (_, connection) = hosts.route(&terminal_id, &window)?;
            let gone = matches!(request, Request::PtyDetach { .. });
            let reply = connection.request(request);
            if gone {
                hosts.routes.remove_of_window(&terminal_id, &window);
            }
            reply
        })
        .await
    }

    /// The pane of `window` for a shell of this machine is gone for good: the
    /// host ends the shell if it belongs to that window. Not through the
    /// terminal's route: a window whose shell another machine shows has none.
    pub async fn pane_closed(
        &self,
        window: WindowLabel,
        terminal_id: TerminalId,
    ) -> CommandResult<()> {
        let hosts = self.0.clone();
        // Off the thread of the UI: the connection may have to be set up.
        blocking(move || {
            hosts.routes.remove_of_window(&terminal_id, &window);
            hosts.local()?.post(Request::PaneClosed {
                terminal_id,
                window,
            })
        })
        .await
    }

    /// The processes under every terminal's shell, on every machine.
    pub async fn terminal_processes(&self) -> CommandResult<Vec<TerminalProcess>> {
        let hosts = self.0.clone();
        blocking(move || Ok(hosts.terminal_processes())).await
    }

    /// Whether `window` is the one that shows the terminal.
    pub fn shows(&self, window: &str, terminal_id: &str) -> bool {
        self.0.routes.is_of_window(terminal_id, window)
    }

    /// The window that spawned or attached the terminal: where its messages go.
    pub fn window_of(&self, terminal_id: &str) -> Option<WindowLabel> {
        self.0.routes.window_of(terminal_id)
    }

    /// The window is gone: its shells end, and those it borrowed from other
    /// machines are let go. Returns at once.
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

    /// The prompts of git and ssh that a run of `session` asks go to this
    /// app while the returned guard lives: its host passes them on. Waits
    /// until the host took it on, so the first prompt finds it. Blocks.
    pub fn own_prompts(&self, session: &str) -> CommandResult<OwnedPrompts> {
        let local = self.0.local()?;
        local.request(Request::OwnPrompts {
            session: session.to_string(),
        })?;
        Ok(OwnedPrompts {
            connection: local,
            session: session.to_string(),
        })
    }

    /// This machine's host, which serves the paired machines too.
    pub fn local_host(&self) -> Option<Arc<LocalHost>> {
        self.0.local_host.clone().ok()
    }

    /// What the app does on its way out: hangs up on every host, so the
    /// other machines get back what was borrowed from them, and ends the
    /// shells of this one.
    pub fn close(&self) {
        self.0.connections.clear();
        if let Ok(local_host) = &self.0.local_host {
            local_host.close();
        }
    }
}

/// Opens this machine's host and puts down the starter hooks reach Cogno by.
fn open_local_host(
    bootstrap_log_dir: Option<std::path::PathBuf>,
) -> Result<Arc<LocalHost>, String> {
    let endpoint = crate::host_endpoint::own_host_endpoint()?;
    let host = LocalHost::open(&endpoint, bootstrap_log_dir).map_err(|error| error.to_string())?;
    if let Some(home) = endpoint.parent() {
        cogno_host::starter::put_down(home);
    }
    Ok(Arc::new(host))
}

/// The terminal a request is about. Every request this app sends through a
/// terminal's route names one.
fn terminal_of(request: &Request) -> CommandResult<&str> {
    request.terminal_id().ok_or_else(|| {
        CommandError::internal("A request about no terminal took a terminal's route")
    })
}

/// The prompts of a run's session that come to this app (`own_prompts`).
/// Dropped - also when the run panics - they are nobody's any more: said on
/// the connection that took them on, never on a new one set up for it.
pub struct OwnedPrompts {
    connection: Arc<HostConnection>,
    session: String,
}

impl Drop for OwnedPrompts {
    fn drop(&mut self) {
        let _ = self.connection.post(Request::DisownPrompts {
            session: std::mem::take(&mut self.session),
        });
    }
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
