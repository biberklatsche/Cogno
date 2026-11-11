//! The hosts this app talks to (`cogno-host`): the one it embeds for this
//! machine's shells, and those on other machines it is connected to
//! (`remote`). The commands turn what the webview asks into requests; what a
//! host reports goes back to the webview from here.

use cogno_host::protocol::{
    Event, PtySpawnResult, Reply, Request, Response, ShellInfo, SpawnOptions,
};
use cogno_host::{EventSink, Host};
use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter};

use crate::remote::RemoteHost;

/// Event to every window: the connection to a host on another machine ended.
const DISCONNECTED_EVENT: &str = "host-disconnected";

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

/// A terminal whose shell runs on another machine.
struct RemoteTerminal {
    host: String,
    /// The window that spawned it: where its end is reported.
    window: String,
    stream: u64,
}

/// By terminal id. The terminals of this machine are not in here: the
/// embedded host knows them itself.
type RemoteTerminals = Arc<Mutex<HashMap<String, RemoteTerminal>>>;

fn emit_exit(app: &AppHandle, window: &str, terminal_id: &str, exit_code: i32) -> bool {
    app.emit_to(
        window,
        &format!("pty-exit:{}", terminal_id),
        serde_json::json!({ "exitCode": exit_code }),
    )
    .is_ok()
}

/// Where every host's events go, the embedded one's and the remote ones'.
struct WebviewSink {
    app: AppHandle,
    streams: Arc<Streams>,
    remote_terminals: RemoteTerminals,
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
                self.remote_terminals.lock().unwrap().remove(&terminal_id);
                emit_exit(&self.app, &owner, &terminal_id, exit_code)
            }
        }
    }
}

struct Hosts {
    app: AppHandle,
    local: Host,
    sink: Arc<WebviewSink>,
    streams: Arc<Streams>,
    /// By the name the config gives the host.
    remotes: Mutex<HashMap<String, Arc<RemoteHost>>>,
    remote_terminals: RemoteTerminals,
    /// One connection is set up at a time: two panes of one host restored
    /// together share a connection instead of each starting one, and the
    /// user is asked one password at a time.
    connecting: Mutex<()>,
}

impl Hosts {
    fn remote(&self, name: &str) -> Result<Arc<RemoteHost>, String> {
        self.remotes
            .lock()
            .unwrap()
            .get(name)
            .filter(|remote| !remote.is_lost())
            .cloned()
            .ok_or_else(|| format!("Not connected to the host {name}"))
    }

    /// The host a terminal runs on, if that is another machine.
    fn remote_of(&self, terminal_id: &str) -> Option<Arc<RemoteHost>> {
        let name = self
            .remote_terminals
            .lock()
            .unwrap()
            .get(terminal_id)
            .map(|terminal| terminal.host.clone())?;
        self.remotes.lock().unwrap().get(&name).cloned()
    }

    /// The connection to `name` ended: its terminals end with it.
    fn lost(&self, name: &str) {
        {
            let mut remotes = self.remotes.lock().unwrap();
            if remotes.get(name).is_some_and(|remote| remote.is_lost()) {
                remotes.remove(name);
            }
        }
        let ended: Vec<(String, RemoteTerminal)> = self
            .remote_terminals
            .lock()
            .unwrap()
            .extract_if(|_, terminal| terminal.host == name)
            .collect();
        for (terminal_id, terminal) in ended {
            self.streams.close(terminal.stream);
            emit_exit(&self.app, &terminal.window, &terminal_id, -1);
        }
        let _ = self.app.emit(
            DISCONNECTED_EVENT,
            HostDisconnected {
                host: name.to_string(),
            },
        );
    }

    /// Answers a request that may take a while.
    fn answer(&self, request: Request) -> Reply {
        if let Request::TerminalProcesses = request {
            return self.terminal_processes();
        }
        let Some(terminal_id) = request.terminal_id().map(str::to_string) else {
            return self.local.handle(request);
        };
        let Some(remote) = self.remote_of(&terminal_id) else {
            return self.local.handle(request);
        };
        let killed = matches!(request, Request::PtyKill { .. });
        let reply = remote.request(request);
        if killed {
            self.remote_terminals.lock().unwrap().remove(&terminal_id);
        }
        reply
    }

    /// The processes under every terminal's shell, on every machine.
    fn terminal_processes(&self) -> Reply {
        let Response::TerminalProcesses(mut processes) =
            self.local.handle(Request::TerminalProcesses)?
        else {
            return Err("The host answered something else".to_string());
        };
        let remotes: Vec<Arc<RemoteHost>> =
            self.remotes.lock().unwrap().values().cloned().collect();
        for remote in remotes {
            // A host that does not answer has no processes to show.
            if let Ok(Response::TerminalProcesses(theirs)) =
                remote.request(Request::TerminalProcesses)
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
        let remote_terminals = RemoteTerminals::default();
        let sink = Arc::new(WebviewSink {
            app: app.clone(),
            streams: streams.clone(),
            remote_terminals: remote_terminals.clone(),
        });
        Self(Arc::new(Hosts {
            app,
            local: Host::new(sink.clone()),
            sink,
            streams,
            remotes: Mutex::new(HashMap::new()),
            remote_terminals,
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
                    hosts.lost(&name);
                }
            }
        };
        let remote = RemoteHost::connect(command, self.0.sink.clone(), on_lost)?;
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
        on_data: Channel<InvokeResponseBody>,
    ) -> Result<PtySpawnResult, String> {
        let hosts = self.0.clone();
        let stream = hosts.streams.open(on_data);
        let spawned = tauri::async_runtime::spawn_blocking(move || {
            let terminal_id = options.name.clone();
            let request = Request::PtySpawn {
                options,
                owner: window.clone(),
                stream,
                env,
            };
            let Some(name) = host else {
                return hosts.local.handle(request);
            };
            let remote = hosts.remote(&name)?;
            // Known before the request goes out: the shell's first output
            // and its end can overtake the reply.
            hosts.remote_terminals.lock().unwrap().insert(
                terminal_id.clone(),
                RemoteTerminal {
                    host: name,
                    window,
                    stream,
                },
            );
            let reply = remote.request(request);
            if reply.is_err() {
                hosts.remote_terminals.lock().unwrap().remove(&terminal_id);
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

    /// The shells installed on `host`, this machine when `None`.
    pub async fn list_shells(&self, host: Option<String>) -> Result<Vec<ShellInfo>, String> {
        let hosts = self.0.clone();
        let reply = tauri::async_runtime::spawn_blocking(move || match host {
            None => hosts.local.handle(Request::ListShells),
            Some(name) => hosts.remote(&name)?.request(Request::ListShells),
        })
        .await
        .map_err(|error| error.to_string())??;
        match reply {
            Response::Shells(shells) => Ok(shells),
            _ => Err("The host answered something else".to_string()),
        }
    }

    /// Answers on the calling thread: only for requests about one terminal
    /// that never block. On another machine the request is sent and not
    /// waited for.
    pub fn handle(&self, request: Request) -> Reply {
        match request.terminal_id().and_then(|id| self.0.remote_of(id)) {
            Some(remote) => remote.post(request).map(|_| Response::Done),
            None => self.0.local.handle(request),
        }
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
        self.0.local.owner_of(terminal_id)
    }

    /// The window is gone: its shells end, on every machine. Returns at once.
    pub fn release_window(&self, label: &str) {
        let release = || Request::ReleaseOwner {
            owner: label.to_string(),
        };
        // The embedded host releases on a thread of its own.
        let _ = self.0.local.handle(release());
        let ended: Vec<RemoteTerminal> = self
            .0
            .remote_terminals
            .lock()
            .unwrap()
            .extract_if(|_, terminal| terminal.window == label)
            .map(|(_, terminal)| terminal)
            .collect();
        for terminal in &ended {
            self.0.streams.close(terminal.stream);
        }
        let remotes: Vec<Arc<RemoteHost>> =
            self.0.remotes.lock().unwrap().values().cloned().collect();
        for remote in remotes {
            let _ = remote.post(release());
        }
    }

    /// Ends every shell and every connection: what the app does on its way out.
    pub fn release_all(&self) {
        self.0.local.release_all();
        // A host on another machine ends its shells when its connection does.
        self.0.remotes.lock().unwrap().clear();
    }
}
