//! The host this app embeds (`cogno-host`): the shells of this machine. The
//! commands turn what the webview asks into requests; what the host reports
//! goes back to the webview from here.

use cogno_host::protocol::{Event, Reply, Request};
use cogno_host::{EventSink, Host};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter};

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

struct WebviewSink {
    app: AppHandle,
    streams: Arc<Streams>,
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
            } => self
                .app
                .emit_to(
                    owner.as_str(),
                    &format!("pty-exit:{}", terminal_id),
                    serde_json::json!({ "exitCode": exit_code }),
                )
                .is_ok(),
        }
    }
}

pub struct HostState {
    host: Arc<Host>,
    streams: Arc<Streams>,
}

impl HostState {
    pub fn new(app: AppHandle) -> Self {
        let streams = Arc::new(Streams::default());
        let sink = Arc::new(WebviewSink {
            app,
            streams: streams.clone(),
        });
        Self {
            host: Arc::new(Host::new(sink)),
            streams,
        }
    }

    /// Registers the channel a session's output goes to; the spawn request
    /// names the stream.
    pub fn open_stream(&self, channel: Channel<InvokeResponseBody>) -> u64 {
        self.streams.open(channel)
    }

    /// For a spawn that failed: no output will end the stream.
    pub fn close_stream(&self, stream: u64) {
        self.streams.close(stream);
    }

    /// Answers on the calling thread: only for requests that never block.
    pub fn handle(&self, request: Request) -> Reply {
        self.host.handle(request)
    }

    /// Answers on a blocking worker, never on the thread that drives the UI.
    pub async fn request(&self, request: Request) -> Reply {
        let host = self.host.clone();
        tauri::async_runtime::spawn_blocking(move || host.handle(request))
            .await
            .map_err(|error| error.to_string())?
    }

    /// The window that spawned the terminal: where its messages go.
    pub fn window_of(&self, terminal_id: &str) -> Option<String> {
        self.host.owner_of(terminal_id)
    }

    /// Ends every shell: what the app does on its way out.
    pub fn release_all(&self) {
        self.host.release_all();
    }
}
