//! The hosts this app talks to (`cogno-host`): this machine's daemon, which
//! holds its shells, and those of other machines it is connected to. The
//! commands turn what the webview asks into requests; what a host reports
//! goes back to the webview from here.

use cogno_host::protocol::{Event, PtySpawnResult, Reply, Request, Response, SpawnOptions};
use cogno_host::EventSink;
use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter};

use crate::host_connection::HostConnection;

/// Event to every window: the connection to a host on another machine ended.
const DISCONNECTED_EVENT: &str = "host-disconnected";
/// How long this machine's daemon may take to introduce itself. It answers
/// at once; this only keeps a stale endpoint, whose port something else has
/// taken, from holding up the app.
const LOCAL_HELLO_PATIENCE: Duration = Duration::from_secs(5);

#[derive(Clone, Serialize)]
struct HostDisconnected {
    host: String,
}

/// The webview channel of every session whose output is still coming.
#[derive(Default)]
struct Streams {
    next: AtomicU64,
    open: Mutex<HashMap<u64, Channel<InvokeResponseBody>>>,
}

impl Streams {
    fn open(&self, channel: Channel<InvokeResponseBody>) -> u64 {
        let stream = self.next.fetch_add(1, Ordering::Relaxed);
        self.open.lock().unwrap().insert(stream, channel);
        stream
    }

    fn close(&self, stream: u64) {
        self.open.lock().unwrap().remove(&stream);
    }

    /// False once the stream is closed or the webview behind it is gone.
    fn send(&self, stream: u64, frame: Vec<u8>) -> bool {
        // The send happens outside the lock: one slow webview must not hold
        // up the output of the other sessions.
        let channel = self.open.lock().unwrap().get(&stream).cloned();
        channel.is_some_and(|channel| channel.send(InvokeResponseBody::Raw(frame)).is_ok())
    }
}

/// A terminal of this app: where its shell runs and which window shows it.
struct Terminal {
    /// The host on another machine; `None` for this machine's daemon.
    host: Option<String>,
    /// The window that spawned it: where its messages and its end go.
    window: String,
    stream: u64,
}

/// By terminal id. A request about a terminal finds its host here, so the
/// webview never has to name it.
type Terminals = Arc<Mutex<HashMap<String, Terminal>>>;

fn emit_exit(app: &AppHandle, window: &str, terminal_id: &str, exit_code: i32) -> bool {
    app.emit_to(
        window,
        &format!("pty-exit:{}", terminal_id),
        serde_json::json!({ "exitCode": exit_code }),
    )
    .is_ok()
}

/// Where every host's events go.
struct WebviewSink {
    app: AppHandle,
    streams: Arc<Streams>,
    terminals: Terminals,
}

impl EventSink for WebviewSink {
    fn emit(&self, event: Event) -> bool {
        match event {
            Event::PtyData { stream, frame } => self.streams.send(stream, frame),
            Event::PtyStreamEnded { stream } => {
                self.streams.close(stream);
                true
            }
            // The owner is the window that spawned the session.
            Event::PtyExit {
                terminal_id,
                owner,
                exit_code,
            } => {
                self.terminals.lock().unwrap().remove(&terminal_id);
                emit_exit(&self.app, &owner, &terminal_id, exit_code)
            }
            // Another Cogno shows the session now: it is not this app's any
            // more, and the window that showed it is told.
            Event::PtyTakenOver { terminal_id, owner } => {
                self.terminals.lock().unwrap().remove(&terminal_id);
                self.app
                    .emit_to(
                        owner.as_str(),
                        &format!("pty-taken-over:{}", terminal_id),
                        (),
                    )
                    .is_ok()
            }
        }
    }
}

struct Hosts {
    app: AppHandle,
    sink: Arc<WebviewSink>,
    streams: Arc<Streams>,
    /// The connection to this machine's daemon, once there was one.
    local: Mutex<Option<Arc<HostConnection>>>,
    /// The connections to other machines, by the name the config gives them.
    remotes: Mutex<HashMap<String, Arc<HostConnection>>>,
    terminals: Terminals,
    /// One connection is set up at a time: two panes of one host restored
    /// together share a connection instead of each starting one, and the
    /// user is asked one password at a time.
    connecting: Mutex<()>,
}

impl Hosts {
    /// The connection to this machine's daemon. It is set up when first
    /// needed and again after it was lost; the daemon is started if none runs.
    fn local(self: &Arc<Self>) -> Result<Arc<HostConnection>, String> {
        let _one_at_a_time = self.connecting.lock().unwrap();
        if let Some(connected) = self
            .local
            .lock()
            .unwrap()
            .as_ref()
            .filter(|connection| !connection.is_lost())
        {
            return Ok(connected.clone());
        }
        let stream = cogno_host::daemon_start::connect_or_start(
            cfg!(debug_assertions),
            env!("CARGO_PKG_VERSION"),
        )?;
        let reader = stream.try_clone().map_err(|error| error.to_string())?;
        let timed = stream.try_clone().map_err(|error| error.to_string())?;
        let _ = timed.set_read_timeout(Some(LOCAL_HELLO_PATIENCE));
        let on_lost = {
            let hosts = Arc::downgrade(self);
            move || {
                if let Some(hosts) = hosts.upgrade() {
                    hosts.lost(None);
                }
            }
        };
        let connection = HostConnection::over(reader, stream, self.sink.clone(), on_lost);
        let _ = timed.set_read_timeout(None);
        let connection = Arc::new(connection?);
        *self.local.lock().unwrap() = Some(connection.clone());
        Ok(connection)
    }

    fn remote(&self, name: &str) -> Result<Arc<HostConnection>, String> {
        self.remotes
            .lock()
            .unwrap()
            .get(name)
            .filter(|remote| !remote.is_lost())
            .cloned()
            .ok_or_else(|| format!("Not connected to the host {name}"))
    }

    /// The connection to `host`, this machine's daemon when `None`.
    fn connection(self: &Arc<Self>, host: Option<&str>) -> Result<Arc<HostConnection>, String> {
        match host {
            None => self.local(),
            Some(name) => self.remote(name),
        }
    }

    /// The connection to the host a terminal of this app runs on.
    fn connection_of(self: &Arc<Self>, terminal_id: &str) -> Result<Arc<HostConnection>, String> {
        let host = self
            .terminals
            .lock()
            .unwrap()
            .get(terminal_id)
            .map(|terminal| terminal.host.clone())
            .ok_or_else(|| format!("Session not found: {terminal_id}"))?;
        self.connection(host.as_deref())
    }

    /// The connection to a host ended: its terminals end with it. `None` is
    /// this machine's daemon.
    fn lost(&self, host: Option<&str>) {
        match host {
            None => {
                let mut local = self.local.lock().unwrap();
                if local
                    .as_ref()
                    .is_some_and(|connection| connection.is_lost())
                {
                    *local = None;
                }
            }
            Some(name) => {
                let mut remotes = self.remotes.lock().unwrap();
                if remotes.get(name).is_some_and(|remote| remote.is_lost()) {
                    remotes.remove(name);
                }
            }
        }
        let ended: Vec<(String, Terminal)> = self
            .terminals
            .lock()
            .unwrap()
            .extract_if(|_, terminal| terminal.host.as_deref() == host)
            .collect();
        for (terminal_id, terminal) in ended {
            self.streams.close(terminal.stream);
            emit_exit(&self.app, &terminal.window, &terminal_id, -1);
        }
        match host {
            Some(name) => {
                let _ = self.app.emit(
                    DISCONNECTED_EVENT,
                    HostDisconnected {
                        host: name.to_string(),
                    },
                );
            }
            None => log::error!(target: "host", "the connection to this machine's host was lost"),
        }
    }

    /// Answers a request that may take a while.
    fn answer(self: &Arc<Self>, request: Request) -> Reply {
        if let Request::TerminalProcesses = request {
            return self.terminal_processes();
        }
        let Some(terminal_id) = request.terminal_id().map(str::to_string) else {
            return self.local()?.request(request);
        };
        let connection = self.connection_of(&terminal_id)?;
        let killed = matches!(request, Request::PtyKill { .. });
        let reply = connection.request(request);
        if killed {
            self.terminals.lock().unwrap().remove(&terminal_id);
        }
        reply
    }

    /// The processes under every terminal's shell, on every machine.
    fn terminal_processes(self: &Arc<Self>) -> Reply {
        let mut connections: Vec<Arc<HostConnection>> =
            self.remotes.lock().unwrap().values().cloned().collect();
        connections.extend(self.local.lock().unwrap().clone());
        let mut processes = Vec::new();
        for connection in connections {
            // A host that does not answer has no processes to show.
            if let Ok(Response::TerminalProcesses(theirs)) =
                connection.request(Request::TerminalProcesses)
            {
                processes.extend(theirs);
            }
        }
        Ok(Response::TerminalProcesses(processes))
    }
}

pub struct HostState(Arc<Hosts>);

impl HostState {
    pub fn new(app: AppHandle) -> Self {
        let streams = Arc::new(Streams::default());
        let terminals = Terminals::default();
        let sink = Arc::new(WebviewSink {
            app: app.clone(),
            streams: streams.clone(),
            terminals: terminals.clone(),
        });
        Self(Arc::new(Hosts {
            app,
            sink,
            streams,
            local: Mutex::new(None),
            remotes: Mutex::new(HashMap::new()),
            terminals,
            connecting: Mutex::new(()),
        }))
    }

    /// Connects to the host `name` by starting `command` (ssh), unless the
    /// connection already stands. Returns the host's operating system. Blocks
    /// for as long as the user needs to answer what ssh asks.
    pub fn connect(&self, name: &str, command: Command) -> Result<String, String> {
        let _one_at_a_time = self.0.connecting.lock().unwrap();
        if let Ok(connected) = self.0.remote(name) {
            return Ok(connected.os().to_string());
        }
        let on_lost = {
            let hosts = Arc::downgrade(&self.0);
            let name = name.to_string();
            move || {
                if let Some(hosts) = hosts.upgrade() {
                    hosts.lost(Some(&name));
                }
            }
        };
        let remote = HostConnection::connect(command, self.0.sink.clone(), on_lost)?;
        let os = remote.os().to_string();
        self.0
            .remotes
            .lock()
            .unwrap()
            .insert(name.to_string(), Arc::new(remote));
        Ok(os)
    }

    /// Starts a shell on `host` (this machine when `None`) for `window`; its
    /// output goes to `on_data`.
    pub async fn spawn(
        &self,
        host: Option<String>,
        options: SpawnOptions,
        window: String,
        env: Vec<(String, String)>,
        survives_client: bool,
        on_data: Channel<InvokeResponseBody>,
    ) -> Result<PtySpawnResult, String> {
        let hosts = self.0.clone();
        let stream = hosts.streams.open(on_data);
        let spawned = tauri::async_runtime::spawn_blocking(move || {
            let terminal_id = options.name.clone();
            let connection = hosts.connection(host.as_deref())?;
            let request = Request::PtySpawn {
                options,
                owner: window.clone(),
                stream,
                env,
                survives_client,
            };
            // Known before the request goes out: the shell's first output
            // and its end can overtake the reply.
            hosts.terminals.lock().unwrap().insert(
                terminal_id.clone(),
                Terminal {
                    host,
                    window,
                    stream,
                },
            );
            let reply = connection.request(request);
            if reply.is_err() {
                hosts.terminals.lock().unwrap().remove(&terminal_id);
            }
            reply
        })
        .await
        .map_err(|error| error.to_string())
        .and_then(|reply| reply);
        match spawned {
            Ok(Response::Spawned(result)) => Ok(result),
            Ok(_) => {
                self.0.streams.close(stream);
                Err("The host did not answer the spawn".to_string())
            }
            // No output will end the stream of a spawn that failed.
            Err(error) => {
                self.0.streams.close(stream);
                Err(error)
            }
        }
    }

    /// Attaches `window` to the shell `terminal_id` that runs on `host` (this
    /// machine when `None`); its output goes to `on_data`.
    pub async fn attach(
        &self,
        host: Option<String>,
        terminal_id: String,
        window: String,
        on_data: Channel<InvokeResponseBody>,
    ) -> Result<(), String> {
        let hosts = self.0.clone();
        let stream = hosts.streams.open(on_data);
        let attached = tauri::async_runtime::spawn_blocking(move || {
            let connection = hosts.connection(host.as_deref())?;
            // Known before the request goes out: what the host kept comes
            // before its reply.
            hosts.terminals.lock().unwrap().insert(
                terminal_id.clone(),
                Terminal {
                    host,
                    window: window.clone(),
                    stream,
                },
            );
            let reply = connection.request(Request::PtyAttach {
                terminal_id: terminal_id.clone(),
                owner: window,
                stream,
            });
            if reply.is_err() {
                hosts.terminals.lock().unwrap().remove(&terminal_id);
            }
            reply
        })
        .await
        .map_err(|error| error.to_string())
        .and_then(|reply| reply);
        if attached.is_err() {
            self.0.streams.close(stream);
        }
        attached.map(|_| ())
    }

    /// Answers a request about a host as a whole, not about one terminal:
    /// `host` is asked, this machine when `None`. On a blocking worker.
    pub async fn request_on(&self, host: Option<String>, request: Request) -> Reply {
        let hosts = self.0.clone();
        tauri::async_runtime::spawn_blocking(move || {
            hosts.connection(host.as_deref())?.request(request)
        })
        .await
        .map_err(|error| error.to_string())?
    }

    /// For requests about one terminal that need no answer (what is typed,
    /// resized, acknowledged): sent and not waited for, so the calling
    /// thread is never held up by the host.
    pub fn post(&self, request: Request) -> Result<(), String> {
        let terminal_id = request
            .terminal_id()
            .ok_or("Not a request about a terminal")?;
        self.0.connection_of(terminal_id)?.post(request)
    }

    /// Asks about one terminal and waits for the answer on the calling
    /// thread: only for what the host answers at once.
    pub fn ask(&self, request: Request) -> Reply {
        let terminal_id = request
            .terminal_id()
            .ok_or("Not a request about a terminal")?;
        self.0.connection_of(terminal_id)?.request(request)
    }

    /// Answers on a blocking worker, never on the thread that drives the UI.
    pub async fn request(&self, request: Request) -> Reply {
        let hosts = self.0.clone();
        tauri::async_runtime::spawn_blocking(move || hosts.answer(request))
            .await
            .map_err(|error| error.to_string())?
    }

    /// The window that spawned the terminal: where its messages go.
    pub fn window_of(&self, terminal_id: &str) -> Option<String> {
        self.0
            .terminals
            .lock()
            .unwrap()
            .get(terminal_id)
            .map(|terminal| terminal.window.clone())
    }

    /// The window is gone: its shells end, on every machine. Returns at once.
    pub fn release_window(&self, label: &str) {
        let ended: Vec<Terminal> = self
            .0
            .terminals
            .lock()
            .unwrap()
            .extract_if(|_, terminal| terminal.window == label)
            .map(|(_, terminal)| terminal)
            .collect();
        for terminal in &ended {
            self.0.streams.close(terminal.stream);
        }
        let mut connections: Vec<Arc<HostConnection>> =
            self.0.remotes.lock().unwrap().values().cloned().collect();
        connections.extend(self.0.local.lock().unwrap().clone());
        for connection in connections {
            // Every host is told, also one without a terminal of this
            // window: a spawn may still be on its way there.
            let _ = connection.post(Request::ReleaseOwner {
                owner: label.to_string(),
            });
        }
    }

    /// Hangs up on every host: what the app does on its way out. A host ends
    /// the shells that were not started to go on without their client.
    pub fn release_all(&self) {
        self.0.remotes.lock().unwrap().clear();
        *self.0.local.lock().unwrap() = None;
    }
}
