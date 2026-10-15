//! Prompts from processes the command runner starts (git, ssh): they get no
//! terminal, so `GIT_ASKPASS`/`SSH_ASKPASS` point at this binary, which asks
//! the window that started the command over the HTTP server (`/askpass`) and
//! prints the answer. One runner session is one running command; its id ties
//! a prompt to the window that must show the dialog.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

/// The variable that turns this binary into the askpass helper.
pub const SESSION_ENV: &str = "COGNO_ASKPASS_SESSION";
/// Event to the window: show a prompt.
pub const REQUEST_EVENT: &str = "askpass-request";
/// Event to the window: the command ended, the prompt is moot.
pub const CLOSED_EVENT: &str = "askpass-closed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassRequest {
    pub request_id: String,
    pub prompt: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassClosed {
    pub request_id: String,
}

struct Pending {
    session_id: String,
    window: String,
    answer: oneshot::Sender<Option<String>>,
}

#[derive(Default)]
pub struct AskpassState {
    /// Runner session -> the window that started the command.
    sessions: Mutex<HashMap<String, String>>,
    pending: Mutex<HashMap<String, Pending>>,
}

impl AskpassState {
    pub fn new() -> Self {
        Self::default()
    }

    /// A command starts in `window`; returns the session id to put in its environment.
    pub fn open_session(&self, window: &str) -> String {
        let id = uuid::Uuid::new_v4().simple().to_string();
        self.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), window.to_string());
        id
    }

    /// The command ended: prompts still open get no answer and the window closes their dialog.
    pub fn close_session(&self, app: &AppHandle, session_id: &str) {
        self.sessions.lock().unwrap().remove(session_id);
        let closed: Vec<(String, Pending)> = {
            let mut pending = self.pending.lock().unwrap();
            let ids: Vec<String> = pending
                .iter()
                .filter(|(_, entry)| entry.session_id == session_id)
                .map(|(id, _)| id.clone())
                .collect();
            ids.into_iter()
                .filter_map(|id| pending.remove(&id).map(|entry| (id, entry)))
                .collect()
        };
        for (request_id, entry) in closed {
            let _ = entry.answer.send(None);
            let _ = app.emit_to(
                entry.window.as_str(),
                CLOSED_EVENT,
                AskpassClosed { request_id },
            );
        }
    }

    /// Whether a prompt of this session waits for the user - the runner's timeout pauses then.
    pub fn has_pending(&self, session_id: &str) -> bool {
        self.pending
            .lock()
            .unwrap()
            .values()
            .any(|entry| entry.session_id == session_id)
    }

    /// Ask the session's window; `None` when the session is unknown.
    pub fn request(
        &self,
        app: &AppHandle,
        session_id: &str,
        prompt: String,
    ) -> Option<oneshot::Receiver<Option<String>>> {
        let window = self.sessions.lock().unwrap().get(session_id)?.clone();
        let request_id = uuid::Uuid::new_v4().simple().to_string();
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().unwrap().insert(
            request_id.clone(),
            Pending {
                session_id: session_id.to_string(),
                window: window.clone(),
                answer: sender,
            },
        );
        let _ = app.emit_to(
            window.as_str(),
            REQUEST_EVENT,
            AskpassRequest { request_id, prompt },
        );
        Some(receiver)
    }

    fn answer(&self, request_id: &str, answer: Option<String>) -> bool {
        match self.pending.lock().unwrap().remove(request_id) {
            Some(entry) => entry.answer.send(answer).is_ok(),
            None => false,
        }
    }
}

/// The window answers a prompt; `None` cancels it, and the process sees a failed read.
#[tauri::command]
pub fn askpass_answer(
    state: State<'_, AskpassState>,
    request_id: String,
    answer: Option<String>,
) -> bool {
    state.answer(&request_id, answer)
}

/// The helper side: runs in the process git or ssh started, asks the running
/// Cogno and prints the answer. Exit 1 means "no answer", which the caller
/// treats as a refused prompt.
pub fn run_helper(session_id: &str, prompt_args: &[String]) -> i32 {
    let port = match std::env::var("COGNO_PORT") {
        Ok(port) => port,
        Err(_) => return 1,
    };
    let token = std::env::var("COGNO_TOKEN").unwrap_or_default();
    let prompt = prompt_args.join(" ");
    let body = serde_json::json!({ "session": session_id, "prompt": prompt });
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60 * 60))
        .build()
    {
        Ok(client) => client,
        Err(_) => return 1,
    };
    let response = match client
        .post(format!("http://127.0.0.1:{port}/askpass"))
        .header(crate::http_server::TOKEN_HEADER, token)
        .json(&body)
        .send()
    {
        Ok(response) => response,
        Err(_) => return 1,
    };
    let payload: serde_json::Value = response.json().unwrap_or_default();
    match payload.get("answer").and_then(|value| value.as_str()) {
        Some(answer) => {
            println!("{answer}");
            0
        }
        None => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_answer_for_an_unknown_request_is_refused() {
        let state = AskpassState::new();
        assert!(!state.answer("nope", Some("x".into())));
    }

    #[test]
    fn a_session_is_pending_only_while_a_prompt_is_open() {
        let state = AskpassState::new();
        let session = state.open_session("main");
        assert!(!state.has_pending(&session));
        let (sender, _receiver) = oneshot::channel();
        state.pending.lock().unwrap().insert(
            "r1".into(),
            Pending {
                session_id: session.clone(),
                window: "main".into(),
                answer: sender,
            },
        );
        assert!(state.has_pending(&session));
        assert!(state.answer("r1", Some("secret".into())));
        assert!(!state.has_pending(&session));
    }
}
