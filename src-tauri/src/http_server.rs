use crate::agent_hooks;
use crate::commands::window_registry::route;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Condvar, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

/// The action names the webview currently accepts, split by whether they would
/// dispatch or are declared-but-inactive (a feature that is off). The webview
/// pushes these via `set_runnable_actions`; the HTTP `/action/run` endpoint
/// classifies against them synchronously. Anything in neither set is
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
    /// A secret for this launch. Only processes started in a Cogno terminal
    /// get it (`COGNO_TOKEN`); every request must carry it.
    token: String,
    /// A second secret, published in the endpoint file for agent hooks that
    /// run outside any terminal (ARCHITECTURE.md 3.2). It opens `/agent-hook`
    /// and nothing else.
    hook_token: String,
    /// The Cogno home the endpoint file was written to, so the exit can take
    /// it away again.
    endpoint_home: Mutex<Option<PathBuf>>,
    start_decided: Mutex<bool>,
    start_decision: Condvar,
}

impl Default for HttpServerState {
    fn default() -> Self {
        Self {
            port: AtomicU16::new(0),
            started: AtomicBool::new(false),
            token: uuid::Uuid::new_v4().simple().to_string(),
            hook_token: uuid::Uuid::new_v4().simple().to_string(),
            endpoint_home: Mutex::new(None),
            start_decided: Mutex::new(false),
            start_decision: Condvar::new(),
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

    pub fn token(&self) -> &str {
        &self.token
    }

    /// Nobody listens any more: the endpoint file must not name this instance.
    pub fn remove_endpoint(&self) {
        let home = self
            .endpoint_home
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        if let Some(home) = home {
            agent_hooks::remove_endpoint(&home);
        }
    }

    fn remember_endpoint(&self, home: PathBuf) {
        *self
            .endpoint_home
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(home);
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

    /// The webview asked for the server (and it is up, disabled or failed).
    fn decide_start(&self) {
        let mut decided = self
            .start_decided
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *decided = true;
        self.start_decision.notify_all();
    }

    /// Waits until the webview's start request has been handled, at most
    /// `max_wait`. A terminal spawned before that would get no COGNO_PORT and
    /// no agent hook could ever reach it; the two requests leave the webview
    /// independently, so the spawn waits for the server's answer here.
    pub fn wait_for_start_decision(&self, max_wait: Duration) -> bool {
        let decided = self
            .start_decided
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (decided, _) = self
            .start_decision
            .wait_timeout_while(decided, max_wait, |decided| !*decided)
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *decided
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

/// What the hook scripts post: which adapter the hook belongs to, the hook
/// event as the adapter named it in the agent's config, the terminal when the
/// hook still had one in its environment, when it ran (Unix milliseconds, for
/// ordering) and the agent's payload as it came.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentHookPayload {
    pub provider: String,
    pub hook_event: Option<String>,
    pub terminal_id: Option<String>,
    pub sent_at: Option<u64>,
    pub payload: Option<serde_json::Value>,
}

/// The message the webview gets for a hook; the feature reads it by this command.
pub const AGENT_HOOK_COMMAND: &str = "coding_agent_hook";

impl AgentHookPayload {
    /// As the webview's message: `args` carries provider, `sentAt` and the
    /// hook event; the terminal stays empty when the hook had none.
    fn into_message(self) -> CognoMessagePayload {
        let terminal_id = self.terminal_id.filter(|id| !id.is_empty());
        CognoMessagePayload {
            command: AGENT_HOOK_COMMAND.to_string(),
            args: Some(vec![
                self.provider,
                self.sent_at.unwrap_or(0).to_string(),
                self.hook_event.unwrap_or_default(),
            ]),
            terminal_id,
            payload: self.payload,
        }
    }
}

/// A prompt from the askpass helper: which runner session asks, and git's prompt text.
#[derive(Debug, Clone, Deserialize)]
pub struct AskpassPayload {
    pub session: String,
    pub prompt: String,
}

/// How long a prompt may stay open before the helper gives up.
const ASKPASS_WAIT: std::time::Duration = std::time::Duration::from_secs(30 * 60);

/// The header every request carries the launch token in.
pub const TOKEN_HEADER: &str = "x-cogno-token";

/// Only a caller that knows this launch's token - a process started in a Cogno
/// terminal - may talk to the server, and only by the loopback name: a web
/// page that rebinds its own host name to 127.0.0.1 sends that name as Host.
fn is_authorized(headers: &axum::http::HeaderMap, token: &str, port: u16) -> bool {
    presented_token(headers) == Some(token) && host_is_loopback(headers, port)
}

/// `/agent-hook` takes the launch token (a hook that still runs in a Cogno
/// terminal) or the hook token from the endpoint file (one that runs in an
/// agent's background service).
fn is_hook_authorized(
    headers: &axum::http::HeaderMap,
    token: &str,
    hook_token: &str,
    port: u16,
) -> bool {
    let presented = presented_token(headers);
    (presented == Some(token) || presented == Some(hook_token)) && host_is_loopback(headers, port)
}

fn presented_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    headers
        .get(TOKEN_HEADER)
        .and_then(|value| value.to_str().ok())
}

fn host_is_loopback(headers: &axum::http::HeaderMap, port: u16) -> bool {
    headers
        .get(axum::http::header::HOST)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|host| {
            host == format!("127.0.0.1:{port}") || host == format!("localhost:{port}")
        })
}

/// Binds the first free port from `start` on - up to 99 above it with
/// `auto_next`. The listener is kept: the port handed to terminals is the one
/// that is served, with no gap in which another process could take it.
fn bind_port(start: u16, auto_next: bool) -> Option<TcpListener> {
    let last = if auto_next {
        start.saturating_add(99)
    } else {
        start
    };
    (start..=last).find_map(|port| TcpListener::bind(("127.0.0.1", port)).ok())
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
    dev_mode: bool,
) -> Result<u16, String> {
    let cogno_home = crate::commands::environment::cogno_home(dev_mode)?;
    if !enabled {
        log::info!(target: "http_server", "HTTP server disabled via config");
        // A file from an earlier run would send hooks to a port nobody serves.
        agent_hooks::remove_endpoint(&cogno_home);
        state.decide_start();
        return Ok(0);
    }

    if !state.try_claim_start() {
        return Ok(state.port());
    }

    let bound = bind_listener(&state, port, auto_next_port);
    state.decide_start();
    let (bound, actual_port) = bound?;

    match agent_hooks::install(
        &cogno_home,
        crate::commands::environment::home_dir_name(dev_mode),
        actual_port,
        &state.hook_token,
    ) {
        Ok(()) => state.remember_endpoint(cogno_home),
        // The server still serves terminals; only hooks without an
        // environment stay unreachable, and the log says why.
        Err(e) => log::error!(target: "http_server", "Cannot write agent hook files: {}", e),
    }

    tauri::async_runtime::spawn(async move {
        use axum::extract::rejection::JsonRejection;
        use axum::extract::Json;
        use axum::http::StatusCode;
        use axum::routing::post;
        use axum::Router;

        let listener = match tokio::net::TcpListener::from_std(bound) {
            Ok(l) => l,
            Err(e) => {
                // Reset state so COGNO_PORT is not set for new terminals and Angular
                // can retry if needed.
                app.state::<HttpServerState>().mark_failed();
                log::error!(target: "http_server", "Failed to serve on port {}: {}", actual_port, e);
                return;
            }
        };

        log::info!(target: "http_server", "HTTP server listening on 127.0.0.1:{}", actual_port);

        let app_emit = app.clone();
        let app_run = app.clone();
        let app_askpass = app.clone();
        let app_hook = app.clone();
        let token = app.state::<HttpServerState>().token().to_string();
        let token_for_run = token.clone();
        let token_for_hook = token.clone();
        let hook_token = app.state::<HttpServerState>().hook_token.clone();
        let router = Router::new()
            .route(
                "/agent-hook",
                post(move |headers: axum::http::HeaderMap, result: Result<Json<AgentHookPayload>, JsonRejection>| {
                    let app = app_hook.clone();
                    let authorized = is_hook_authorized(&headers, &token_for_hook, &hook_token, actual_port);
                    async move {
                        if !authorized {
                            log::warn!(target: "http_server", "POST /agent-hook rejected: missing or wrong token");
                            return StatusCode::FORBIDDEN;
                        }
                        match result {
                            Ok(Json(payload)) => {
                                log::info!(target: "http_server", "POST /agent-hook: provider={} terminal_id={:?}", payload.provider, payload.terminal_id);
                                let message = payload.into_message();
                                let terminal_id = message.terminal_id.clone();
                                route(&app, "cogno-message", message, terminal_id.as_deref());
                                StatusCode::NO_CONTENT
                            }
                            Err(e) => {
                                log::error!(target: "http_server", "POST /agent-hook parse error: {}", e);
                                StatusCode::BAD_REQUEST
                            }
                        }
                    }
                }),
            )
            .route(
                "/action",
                post(move |headers: axum::http::HeaderMap, result: Result<Json<CognoMessagePayload>, JsonRejection>| {
                    let app = app_emit.clone();
                    let authorized = is_authorized(&headers, &token, actual_port);
                    async move {
                        if !authorized {
                            log::warn!(target: "http_server", "POST /action rejected: missing or wrong token");
                            return StatusCode::FORBIDDEN;
                        }
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
                post(move |headers: axum::http::HeaderMap, result: Result<Json<ActionRunPayload>, JsonRejection>| {
                    let app = app_run.clone();
                    let authorized = is_authorized(&headers, &token_for_run, actual_port);
                    async move {
                        if !authorized {
                            log::warn!(target: "http_server", "POST /action/run rejected: missing or wrong token");
                            return (
                                StatusCode::FORBIDDEN,
                                Json(serde_json::json!({ "error": "forbidden" })),
                            );
                        }
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
            )
            .route(
                "/askpass",
                post(move |headers: axum::http::HeaderMap, result: Result<Json<AskpassPayload>, JsonRejection>| {
                    let app = app_askpass.clone();
                    async move {
                        let payload = match result {
                            Ok(Json(payload)) => payload,
                            Err(e) => {
                                return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() })));
                            }
                        };
                        // The run's own token, not the launch token: see askpass.rs.
                        let askpass = app.state::<crate::commands::askpass::AskpassState>();
                        let authorized = host_is_loopback(&headers, actual_port)
                            && presented_token(&headers)
                                .is_some_and(|token| askpass.authorizes(&payload.session, token));
                        if !authorized {
                            log::warn!(target: "http_server", "POST /askpass rejected: missing or wrong token");
                            return (StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "forbidden" })));
                        }
                        let Some((request_id, receiver)) = askpass.request(&app, &payload.session, payload.prompt) else {
                            log::warn!(target: "http_server", "POST /askpass: unknown session or closed window");
                            return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "unknown session" })));
                        };
                        // The user may take a while; the helper waits, and the runner's timeout pauses.
                        let answer = match tokio::time::timeout(ASKPASS_WAIT, receiver).await {
                            Ok(received) => received.ok().flatten(),
                            Err(_) => {
                                askpass.expire(&app, &request_id);
                                None
                            }
                        };
                        (StatusCode::OK, Json(serde_json::json!({ "answer": answer })))
                    }
                }),
            );

        if let Err(e) = axum::serve(listener, router).await {
            log::error!(target: "http_server", "HTTP server error: {}", e);
        }
        // Nobody listens any more: new terminals must not inherit a dead port,
        // and no hook must find it in the endpoint file.
        app.state::<HttpServerState>().mark_failed();
        app.state::<HttpServerState>().remove_endpoint();
    });

    Ok(actual_port)
}

/// Binds and records the port. Every failure hands the claim back, so the
/// state never says "started" for a server that is not listening: a webview
/// retry can start it, and no terminal gets a COGNO_PORT nothing answers on.
fn bind_listener(
    state: &HttpServerState,
    port: u16,
    auto_next_port: bool,
) -> Result<(TcpListener, u16), String> {
    let result = (|| {
        let bound = bind_port(port, auto_next_port)
            .ok_or_else(|| format!("No available port found starting from {}", port))?;
        let actual_port = bound.local_addr().map_err(|e| e.to_string())?.port();
        bound.set_nonblocking(true).map_err(|e| e.to_string())?;
        Ok((bound, actual_port))
    })();
    match result {
        Ok((bound, actual_port)) => {
            state.set_port(actual_port);
            Ok((bound, actual_port))
        }
        Err(error) => {
            state.mark_failed();
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{header::HOST, HeaderMap, HeaderValue};

    #[test]
    fn binds_the_next_free_port_and_keeps_it() {
        let taken = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let start = taken.local_addr().unwrap().port();

        let bound = bind_port(start, true).expect("a free port above the taken one");
        let port = bound.local_addr().unwrap().port();

        assert_ne!(port, start);
        // Still held: nobody else can take it before the server uses it.
        assert!(TcpListener::bind(("127.0.0.1", port)).is_err());
    }

    #[test]
    fn stays_on_the_configured_port_without_auto_next() {
        let taken = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let start = taken.local_addr().unwrap().port();

        assert!(bind_port(start, false).is_none());
    }

    #[test]
    fn the_last_port_does_not_overflow() {
        // Whether 65535 is free or not, this must not panic.
        let _ = bind_port(u16::MAX, true);
    }

    fn headers(token: Option<&str>, host: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(HOST, HeaderValue::from_str(host).unwrap());
        if let Some(token) = token {
            headers.insert(TOKEN_HEADER, HeaderValue::from_str(token).unwrap());
        }
        headers
    }

    #[test]
    fn accepts_the_launch_token_on_the_loopback_name() {
        assert!(is_authorized(
            &headers(Some("secret"), "127.0.0.1:9000"),
            "secret",
            9000
        ));
        assert!(is_authorized(
            &headers(Some("secret"), "localhost:9000"),
            "secret",
            9000
        ));
    }

    #[test]
    fn rejects_a_missing_or_wrong_token() {
        assert!(!is_authorized(
            &headers(None, "127.0.0.1:9000"),
            "secret",
            9000
        ));
        assert!(!is_authorized(
            &headers(Some("guess"), "127.0.0.1:9000"),
            "secret",
            9000
        ));
    }

    #[test]
    fn rejects_a_rebound_host_name_even_with_the_token() {
        assert!(!is_authorized(
            &headers(Some("secret"), "evil.example:9000"),
            "secret",
            9000
        ));
        assert!(!is_authorized(
            &headers(Some("secret"), "127.0.0.1:9001"),
            "secret",
            9000
        ));
    }

    #[test]
    fn the_hook_route_takes_either_token_but_nothing_else() {
        let hook = |token: Option<&str>, host: &str| {
            is_hook_authorized(&headers(token, host), "launch", "hook", 9000)
        };
        assert!(hook(Some("launch"), "127.0.0.1:9000"));
        assert!(hook(Some("hook"), "localhost:9000"));
        assert!(!hook(Some("guess"), "127.0.0.1:9000"));
        assert!(!hook(None, "127.0.0.1:9000"));
        assert!(!hook(Some("hook"), "evil.example:9000"));
    }

    #[test]
    fn the_hook_token_does_not_open_the_other_routes() {
        assert!(!is_authorized(
            &headers(Some("hook"), "127.0.0.1:9000"),
            "launch",
            9000
        ));
    }

    #[test]
    fn a_hook_becomes_a_message_with_provider_and_order_but_no_empty_terminal() {
        let message = AgentHookPayload {
            provider: "codex".into(),
            hook_event: Some("Stop".into()),
            terminal_id: Some(String::new()),
            sent_at: Some(1700000000123),
            payload: Some(serde_json::json!({ "session_id": "s1" })),
        }
        .into_message();

        assert_eq!(message.command, AGENT_HOOK_COMMAND);
        assert_eq!(
            message.args,
            Some(vec![
                "codex".to_string(),
                "1700000000123".to_string(),
                "Stop".to_string()
            ])
        );
        assert_eq!(message.terminal_id, None);
        assert_eq!(message.payload, Some(serde_json::json!({ "session_id": "s1" })));
    }

    #[test]
    fn a_failed_bind_hands_the_start_claim_back() {
        let taken = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = taken.local_addr().unwrap().port();
        let state = HttpServerState::new();
        assert!(state.try_claim_start());

        assert!(bind_listener(&state, port, false).is_err());

        assert_eq!(state.port(), 0);
        assert!(
            state.try_claim_start(),
            "the next start attempt must be possible"
        );
    }

    #[test]
    fn a_successful_bind_records_the_port() {
        let state = HttpServerState::new();
        assert!(state.try_claim_start());

        let (_listener, port) = bind_listener(&state, 0, false).unwrap();

        assert_ne!(port, 0);
        assert_eq!(state.port(), port);
        assert!(!state.try_claim_start());
    }

    #[test]
    fn the_start_decision_is_waited_for_and_then_known() {
        let state = std::sync::Arc::new(HttpServerState::new());
        assert!(!state.wait_for_start_decision(Duration::from_millis(50)));

        let deciding = state.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            deciding.decide_start();
        });

        assert!(state.wait_for_start_decision(Duration::from_secs(5)));
        assert!(state.wait_for_start_decision(Duration::ZERO));
    }

    #[test]
    fn every_launch_gets_its_own_token() {
        assert_ne!(
            HttpServerState::new().token(),
            HttpServerState::new().token()
        );
        assert!(HttpServerState::new().token().len() >= 32);
    }
}
