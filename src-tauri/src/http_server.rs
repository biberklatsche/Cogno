use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct HttpServerState {
    port: AtomicU16,
    started: AtomicBool,
}

impl Default for HttpServerState {
    fn default() -> Self {
        Self {
            port: AtomicU16::new(0),
            started: AtomicBool::new(false),
        }
    }
}

impl HttpServerState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn port(&self) -> u16 {
        self.port.load(Ordering::Relaxed)
    }

    fn try_claim_start(&self) -> bool {
        self.started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::Relaxed)
            .is_ok()
    }

    fn set_port(&self, port: u16) {
        self.port.store(port, Ordering::Relaxed);
    }

    fn mark_failed(&self) {
        self.port.store(0, Ordering::Relaxed);
        self.started.store(false, Ordering::Relaxed);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CognoMessagePayload {
    pub action: String,
    pub args: Option<Vec<String>>,
    // rename_all makes this serialize as "terminalId" (matches CognoMessage TypeScript interface).
    // The alias keeps accepting "terminal_id" from curl/PowerShell hooks.
    #[serde(alias = "terminal_id")]
    pub terminal_id: Option<String>,
}

fn find_port(start: u16, auto_next: bool) -> Option<u16> {
    if TcpListener::bind(("127.0.0.1", start)).is_ok() {
        return Some(start);
    }
    if !auto_next {
        return None;
    }
    for port in (start + 1)..=start.saturating_add(99) {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

/// Called by Angular after the config has been validated.
/// Returns the actual port the server is listening on, or 0 if disabled.
#[tauri::command]
pub fn start_http_server(
    app: AppHandle,
    state: State<'_, HttpServerState>,
    enabled: bool,
    port: u16,
    auto_next_port: bool,
) -> Result<u16, String> {
    if !enabled {
        log::info!(target: "http_server", "HTTP server disabled via config");
        return Ok(0);
    }

    if !state.try_claim_start() {
        return Ok(state.port());
    }

    let actual_port = find_port(port, auto_next_port)
        .ok_or_else(|| format!("No available port found starting from {}", port))?;

    state.set_port(actual_port);

    tauri::async_runtime::spawn(async move {
        use axum::extract::Json;
        use axum::http::StatusCode;
        use axum::routing::post;
        use axum::Router;

        let addr = std::net::SocketAddr::from(([127, 0, 0, 1], actual_port));
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                // Port was taken between find_port() check and actual bind (TOCTOU).
                // Reset state so COGNO_PORT is not set for new terminals and Angular
                // can retry if needed.
                app.state::<HttpServerState>().mark_failed();
                log::error!(target: "http_server", "Failed to bind HTTP server on port {}: {}", actual_port, e);
                return;
            }
        };

        log::info!(target: "http_server", "HTTP server listening on 127.0.0.1:{}", actual_port);

        let app_emit = app.clone();
        let router = Router::new().route(
            "/action",
            post(move |Json(payload): Json<CognoMessagePayload>| {
                let app = app_emit.clone();
                async move {
                    let _ = app.emit("cogno-message", payload);
                    StatusCode::NO_CONTENT
                }
            }),
        );

        if let Err(e) = axum::serve(listener, router).await {
            log::error!(target: "http_server", "HTTP server error: {}", e);
        }
    });

    Ok(actual_port)
}

#[tauri::command]
pub fn get_http_server_port(state: State<'_, HttpServerState>) -> u16 {
    state.port()
}
