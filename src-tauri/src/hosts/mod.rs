//! The hosts this app talks to (`cogno-host`): this machine's daemon, which
//! holds its shells, and those of other machines it is connected to. The
//! commands turn what the webview asks into requests; what a host reports
//! goes back to the webview from here.

mod connections;
mod questions;
mod routes;
mod webview;

use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use cogno_host::protocol::{
    HostErrorCode, Request, Response, SessionInfo, SessionLifetime, SpawnOptions, StreamId,
    TerminalId, TerminalProcess, WindowLabel,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::AppHandle;

use crate::command_error::{AppErrorCode, CommandError, CommandResult, ErrorCode};
use crate::host_connection::{Ending, HostConnection, OnLost, Starting};
use crate::host_endpoint::DEVELOPMENT_BUILD;
use connections::{Connected, Connections, Lost};
use routes::{Route, TerminalRoutes};
use webview::{TerminalExit, WebviewEvents};

/// What a start asks for, past the shell itself.
pub struct SpawnRequest {
    pub options: SpawnOptions,
    pub window: WindowLabel,
    pub lifetime: SessionLifetime,
    pub on_data: Channel<InvokeResponseBody>,
}

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

    /// The connection to this machine's daemon, which is started if none
    /// runs.
    fn local(self: &Arc<Self>) -> CommandResult<Arc<HostConnection>> {
        self.connections.local(|| {
            let stream = cogno_host::daemon_start::connect_or_start(
                DEVELOPMENT_BUILD,
                env!("CARGO_PKG_VERSION"),
            )
            .map_err(|message| CommandError::new(AppErrorCode::HostNotStarted, message))?;
            HostConnection::to_this_machine(stream, self.events.clone(), self.on_lost(None))
        })
    }

    /// The connection to this machine's daemon if one runs; none is started.
    fn local_if_running(self: &Arc<Self>) -> CommandResult<Arc<HostConnection>> {
        self.connections.local(|| {
            let endpoint =
                crate::host_endpoint::own_host_endpoint().map_err(CommandError::internal)?;
            let stream = cogno_host::daemon::connect(&endpoint).map_err(|error| {
                CommandError::new(AppErrorCode::HostNotStarted, error.to_string())
            })?;
            HostConnection::to_this_machine(stream, self.events.clone(), self.on_lost(None))
        })
    }

    /// The connection to `host`, this machine's daemon when `None`.
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

    /// The connection `connection` to a host ended (`None` is this machine's
    /// daemon): the terminals that came through it end with it. A newer
    /// connection to the same host - it was hung up and set up again - and
    /// its terminals stay.
    fn lost(&self, host: Option<&str>, connection: u64, ending: Ending) {
        let lost = self.connections.forget(host, connection);
        let exit = match ending {
            Ending::HungUp => TerminalExit::HungUp,
            Ending::Lost => TerminalExit::ConnectionLost,
        };
        for (terminal_id, route) in self.routes.drain_connection(connection) {
            self.events.streams.close(route.stream);
            self.events.exit(&route.window, &terminal_id, exit);
        }
        // Hung up on: nothing was lost. Replaced: the host is still there.
        if ending == Ending::HungUp || lost == Lost::Replaced {
            return;
        }
        match host {
            Some(name) => self.events.disconnected(name),
            None => log::error!(target: "host", "the connection to this machine's host was lost"),
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
    pub fn connect(
        &self,
        name: &str,
        commands: &[String],
        command: impl Fn(&str) -> CommandResult<Command>,
    ) -> CommandResult<Connected> {
        let hosts = &self.0;
        hosts.connections.connect_remote(
            name,
            commands,
            |candidate| Starting::spawn(command(candidate)?),
            |starting| {
                starting.introduce(
                    name,
                    hosts.events.clone(),
                    hosts.on_lost(Some(name.to_string())),
                )
            },
        )
    }

    /// Connects to the paired machine `name` (ARCHITECTURE.md 2.7.3), unless
    /// the connection already stands.
    pub fn connect_paired(
        &self,
        name: &str,
        pairing: &crate::pairing::Pairing,
    ) -> CommandResult<Connected> {
        let hosts = &self.0;
        hosts.connections.connect_remote(
            name,
            &[name.to_string()],
            |_| pairing.dial(name),
            |dialing| {
                dialing.introduce(
                    name,
                    hosts.events.clone(),
                    hosts.on_lost(Some(name.to_string())),
                )
            },
        )
    }

    /// Starts a shell on this machine for `request.window`.
    pub async fn spawn(&self, request: SpawnRequest) -> CommandResult<Spawned> {
        let SpawnRequest {
            options,
            window,
            lifetime,
            on_data,
        } = request;
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
                    lifetime,
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
        // Ending ssh waits for the process: not on the thread of the UI.
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
            let gone = matches!(request, Request::PtyKill { .. } | Request::PtyDetach { .. });
            let reply = connection.request(request);
            if gone {
                hosts.routes.remove_of_window(&terminal_id, &window);
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

    /// Ends this machine's daemon and the shells in it - if it still is one
    /// this Cogno cannot talk to: another window may have ended it already,
    /// and started a new one.
    pub async fn end_local_host(&self) -> CommandResult<()> {
        blocking(|| {
            cogno_host::daemon_start::end_incompatible_daemon(DEVELOPMENT_BUILD)
                .map_err(CommandError::internal)
        })
        .await
    }

    /// The prompts of git and ssh that a run of `session` asks go to this
    /// app while the returned guard lives: its host passes them on. Waits
    /// until the host took it on, so the first prompt finds it. Blocks. A
    /// daemon is not started for it: without one, nothing can ask anyway.
    pub fn own_prompts(&self, session: &str) -> CommandResult<OwnedPrompts> {
        let local = self.0.local_if_running()?;
        local.request(Request::OwnPrompts {
            session: session.to_string(),
        })?;
        Ok(OwnedPrompts {
            connection: local,
            session: session.to_string(),
        })
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
