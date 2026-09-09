use crate::commands::window_registry::route;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// The action names the webview currently accepts, split by whether they would
/// dispatch or are declared-but-inactive (a feature that is off). The webview
/// pushes these via `set_runnable_actions`; the HTTP `/action/run` endpoint
/// classifies against them synchronously (step 26g). Anything in neither set is
/// unknown.
#[derive(Default)]
pub struct RunnableActionsState {
    dispatched: Mutex<HashSet<String>>,
    inactive: Mutex<HashSet<String>>,
}

impl RunnableActionsState {
    pub fn new() -> Self {
        Self::default()
    }

    fn classify(&self, name: &str) -> &'static str {
        if self.dispatched.lock().unwrap().contains(name) {
            "dispatched"
        } else if self.inactive.lock().unwrap().contains(name) {
            "inactive"
        } else {
            "unknown"
        }
    }
}

/// The webview reports which actions are dispatchable vs inactive right now.
#[tauri::command]
pub fn set_runnable_actions(
    state: State<'_, RunnableActionsState>,
    dispatched: Vec<String>,
    inactive: Vec<String>,
) {
    *state.dispatched.lock().unwrap() = dispatched.into_iter().collect();
    *state.inactive.lock().unwrap() = inactive.into_iter().collect();
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionRunPayload {
    pub name: String,
    pub args: Option<Vec<String>>,
}

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
    pub command: String,
    pub args: Option<Vec<String>>,
    // rename_all makes this serialize as "terminalId" (matches CognoMessage TypeScript interface).
    // The alias keeps accepting "terminal_id" from curl/PowerShell hooks.
    #[serde(alias = "terminal_id")]
    pub terminal_id: Option<String>,
    // Arbitrary JSON forwarded as-is (e.g. an agent hook's stdin payload). Consumers
    // parse this themselves; the server never inspects its shape.
    pub payload: Option<serde_json::Value>,
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
        use axum::extract::rejection::JsonRejection;
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
        let app_run = app.clone();
        let router = Router::new()
            .route(
                "/action",
                post(move |result: Result<Json<CognoMessagePayload>, JsonRejection>| {
                    let app = app_emit.clone();
                    async move {
                        match result {
                            Ok(Json(payload)) => {
                                log::info!(target: "http_server", "POST /action: command={} terminal_id={:?}", payload.command, payload.terminal_id);
                                let terminal_id = payload.terminal_id.clone();
                                route(&app, "cogno-message", payload, terminal_id.as_deref());
                                StatusCode::NO_CONTENT
                            }
                            Err(e) => {
                                log::error!(target: "http_server", "POST /action parse error: {}", e);
                                StatusCode::BAD_REQUEST
                            }
                        }
                    }
                }),
            )
            .route(
                "/action/run",
                post(move |result: Result<Json<ActionRunPayload>, JsonRejection>| {
                    let app = app_run.clone();
                    async move {
                        match result {
                            Ok(Json(payload)) => {
                                let status = app.state::<RunnableActionsState>().classify(&payload.name);
                                log::info!(target: "http_server", "POST /action/run: name={} -> {}", payload.name, status);
                                if status == "dispatched" {
                                    // Reuse the cli-action path: name[:arg...] the webview parses.
                                    let mut parts = vec![payload.name.clone()];
                                    if let Some(args) = &payload.args {
                                        parts.extend(args.clone());
                                    }
                                    route(&app, "cli-action", parts.join(":"), None);
                                }
                                let code = match status {
                                    "dispatched" => StatusCode::OK,
                                    "inactive" => StatusCode::CONFLICT,
                                    _ => StatusCode::NOT_FOUND,
                                };
                                (code, Json(serde_json::json!({ "status": status })))
                            }
                            Err(e) => (
                                StatusCode::BAD_REQUEST,
                                Json(serde_json::json!({ "error": e.to_string() })),
                            ),
                        }
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
