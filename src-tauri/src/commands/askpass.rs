//! Prompts from processes the command runner starts (git, ssh): they get no
//! terminal, so `GIT_ASKPASS`/`SSH_ASKPASS` point at this binary, which asks
//! the window that started the command over the HTTP server (`/askpass`) and
//! prints the answer. One runner session is one running command; the caller
//! names its id, so the window can hand the prompt to whoever started the run.
//!
//! Each session has a token of its own that opens `/askpass` and
//! `/credential` for that session and nothing else. Everything git starts inherits the run's
//! environment (hooks in the repository, remote helpers, the credential
//! helper); with the launch token in there, a hook could drive the agent
//! endpoints. With the session token it can at most ask its own run's window.
//!
//! Git's credential helper asks the same way (`sign_ins/helper.rs`, `POST
//! /credential`): a question for an origin nobody is signed in to goes to the
//! window of the run, with the origin instead of a prompt text.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

/// The variable that turns this binary into the askpass helper.
pub const SESSION_ENV: &str = "COGNO_ASKPASS_SESSION";
/// How long a question may stay open before the helper gets no answer. The
/// person may take a while; the runner's timeout pauses meanwhile.
const WAIT: std::time::Duration = std::time::Duration::from_secs(30 * 60);
/// Event to the window: show a prompt.
pub const REQUEST_EVENT: &str = "askpass-request";
/// Event to the window: git needs credentials for an origin.
pub const CREDENTIAL_EVENT: &str = "credential-request";
/// Event to the window: the command ended, the prompt is moot.
pub const CLOSED_EVENT: &str = "askpass-closed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassRequest {
    pub request_id: String,
    /// The runner session the caller named when it started the command.
    pub session_id: String,
    pub prompt: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialRequest {
    pub request_id: String,
    pub session_id: String,
    /// `https://host[:port]`, as git names it.
    pub origin: String,
}

/// What a run asks its window.
pub enum Question {
    /// What the process would have printed on a terminal.
    Prompt(String),
    /// Credentials for an origin.
    Credential(String),
}

/// What the window says.
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CredentialAnswer {
    /// The person signed in in the browser; the backend holds the token.
    SignedIn,
    /// Typed by hand, handed to git as it is.
    Typed { username: String, password: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Answer {
    Text(String),
    Credential(CredentialAnswer),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskpassClosed {
    pub request_id: String,
}

struct Pending {
    session_id: String,
    window: String,
    answer: oneshot::Sender<Option<Answer>>,
}

struct Session {
    /// The window that started the command.
    window: String,
    /// What the run's processes present on `/askpass`.
    token: String,
    /// Whether the run has somebody who answers credential requests.
    answers_credentials: bool,
    /// The origin git reported a rejected credential for, if it did.
    credential_rejected_for: Option<String>,
}

#[derive(Default)]
pub struct AskpassState {
    sessions: Mutex<HashMap<String, Session>>,
    pending: Mutex<HashMap<String, Pending>>,
}

impl AskpassState {
    pub fn new() -> Self {
        Self::default()
    }

    /// A command with the caller's session id starts in `window`. Returns
    /// the token its processes get for `/askpass`.
    pub fn open_session(
        &self,
        session_id: &str,
        window: &str,
        answers_credentials: bool,
    ) -> String {
        let token = uuid::Uuid::new_v4().simple().to_string();
        self.sessions.lock().unwrap().insert(
            session_id.to_string(),
            Session {
                window: window.to_string(),
                token: token.clone(),
                answers_credentials,
                credential_rejected_for: None,
            },
        );
        token
    }

    /// Whether `token` is the one this session's processes were given.
    pub fn authorizes(&self, session_id: &str, token: &str) -> bool {
        self.sessions
            .lock()
            .unwrap()
            .get(session_id)
            .is_some_and(|session| session.token == token)
    }

    /// Whether a credential request of this session has anybody to go to.
    /// Without, git goes on to its own prompt and no window is asked.
    pub fn answers_credentials(&self, session_id: &str) -> bool {
        self.sessions
            .lock()
            .unwrap()
            .get(session_id)
            .is_some_and(|session| session.answers_credentials)
    }

    /// Git told its helpers the credential for `origin` was rejected: the run
    /// failed on its access, whoever the credential came from.
    pub fn note_credential_rejected(&self, session_id: &str, origin: &str) {
        if let Some(session) = self.sessions.lock().unwrap().get_mut(session_id) {
            session.credential_rejected_for = Some(origin.to_string());
        }
    }

    /// The command ended: prompts still open get no answer and the window
    /// closes their dialog. Returns the origin whose credential git rejected.
    pub fn close_session(&self, app: &AppHandle, session_id: &str) -> Option<String> {
        let rejected = self
            .sessions
            .lock()
            .unwrap()
            .remove(session_id)
            .and_then(|session| session.credential_rejected_for);
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
        rejected
    }

    /// Whether a prompt of this session waits for the user - the runner's timeout pauses then.
    pub fn has_pending(&self, session_id: &str) -> bool {
        self.pending
            .lock()
            .unwrap()
            .values()
            .any(|entry| entry.session_id == session_id)
    }

    /// Ask the session's window; `None` when the session is unknown or its
    /// window is gone (closed while the command still ran): nobody could
    /// answer, so the process gets its refusal now rather than after the
    /// full prompt time.
    fn request(
        &self,
        app: &AppHandle,
        session_id: &str,
        question: Question,
    ) -> Option<(String, oneshot::Receiver<Option<Answer>>)> {
        let window = self
            .sessions
            .lock()
            .unwrap()
            .get(session_id)?
            .window
            .clone();
        if app.get_webview_window(&window).is_none() {
            log::warn!(target: "askpass", "prompt for a closed window {window}; refused");
            return None;
        }
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
        let _ = match question {
            Question::Prompt(prompt) => app.emit_to(
                window.as_str(),
                REQUEST_EVENT,
                AskpassRequest {
                    request_id: request_id.clone(),
                    session_id: session_id.to_string(),
                    prompt,
                },
            ),
            Question::Credential(origin) => app.emit_to(
                window.as_str(),
                CREDENTIAL_EVENT,
                CredentialRequest {
                    request_id: request_id.clone(),
                    session_id: session_id.to_string(),
                    origin,
                },
            ),
        };
        Some((request_id, receiver))
    }

    /// Asks the session's window and waits for the answer. The outer `None`:
    /// nobody could be asked. The inner one: refused, or not answered within
    /// `WAIT` - the question is forgotten then, so the run's timeout counts
    /// again.
    pub async fn ask(
        &self,
        app: &AppHandle,
        session_id: &str,
        question: Question,
    ) -> Option<Option<Answer>> {
        let (request_id, receiver) = self.request(app, session_id, question)?;
        Some(match tokio::time::timeout(WAIT, receiver).await {
            Ok(received) => received.ok().flatten(),
            Err(_) => {
                self.expire(app, &request_id);
                None
            }
        })
    }

    /// Nobody answered in time: the prompt is forgotten, so the run's
    /// timeout counts again, and the window drops its dialog.
    fn expire(&self, app: &AppHandle, request_id: &str) {
        if let Some(entry) = self.forget(request_id) {
            let _ = app.emit_to(
                entry.window.as_str(),
                CLOSED_EVENT,
                AskpassClosed {
                    request_id: request_id.to_string(),
                },
            );
        }
    }

    fn forget(&self, request_id: &str) -> Option<Pending> {
        self.pending.lock().unwrap().remove(request_id)
    }

    fn answer(&self, request_id: &str, answer: Option<Answer>) -> bool {
        match self.forget(request_id) {
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
    state.answer(&request_id, answer.map(Answer::Text))
}

/// The window answers a credential request; `None` refuses it, and git stops asking.
#[tauri::command]
pub fn credential_answer(
    state: State<'_, AskpassState>,
    request_id: String,
    answer: Option<CredentialAnswer>,
) -> bool {
    state.answer(&request_id, answer.map(Answer::Credential))
}

/// The helper side: runs in the process git or ssh started, asks the running
/// Cogno and prints the answer. Exit 1 means "no answer", which the caller
/// treats as a refused prompt.
pub fn run_helper(session_id: &str, prompt_args: &[String]) -> i32 {
    let prompt = prompt_args.join(" ");
    let body = serde_json::json!({ "session": session_id, "prompt": prompt });
    let answer = ask_running_cogno("askpass", &body);
    match answer
        .as_ref()
        .and_then(|payload| payload.get("answer"))
        .and_then(|value| value.as_str())
    {
        Some(answer) => {
            println!("{answer}");
            0
        }
        None => 1,
    }
}

/// How a helper process reaches the Cogno that started its run: one request
/// to the local server, with the token from its environment. `None` when
/// there is no server to ask or it gave no answer.
pub fn ask_running_cogno(path: &str, body: &serde_json::Value) -> Option<serde_json::Value> {
    let port = std::env::var("COGNO_PORT").ok()?;
    let token = std::env::var("COGNO_TOKEN").unwrap_or_default();
    let client = reqwest::blocking::Client::builder()
        // A dialog or a sign-in in the browser may take a while.
        .timeout(std::time::Duration::from_secs(60 * 60))
        // The server is on this machine; no proxy has a say.
        .no_proxy()
        .build()
        .ok()?;
    client
        .post(format!("http://127.0.0.1:{port}/{path}"))
        .header(crate::http_server::TOKEN_HEADER, token)
        .json(body)
        .send()
        .ok()?
        .json()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_answer_for_an_unknown_request_is_refused() {
        let state = AskpassState::new();
        assert!(!state.answer("nope", Some(Answer::Text("x".into()))));
    }

    #[test]
    fn a_session_token_opens_only_its_own_session() {
        let state = AskpassState::new();
        let first = state.open_session("s1", "main", false);
        let second = state.open_session("s2", "main", false);

        assert!(state.authorizes("s1", &first));
        assert!(state.authorizes("s2", &second));
        assert!(!state.authorizes("s1", &second));
        assert!(!state.authorizes("s3", &first));
        assert!(!state.authorizes("s1", ""));
    }

    #[test]
    fn an_expired_prompt_no_longer_counts_as_pending() {
        let state = AskpassState::new();
        state.open_session("s1", "main", false);
        let (sender, _receiver) = oneshot::channel();
        state.pending.lock().unwrap().insert(
            "r1".into(),
            Pending {
                session_id: "s1".into(),
                window: "main".into(),
                answer: sender,
            },
        );

        assert!(state.forget("r1").is_some());

        assert!(!state.has_pending("s1"));
        assert!(!state.answer("r1", Some(Answer::Text("late".into()))));
    }

    #[test]
    fn a_session_is_pending_only_while_a_prompt_is_open() {
        let state = AskpassState::new();
        let session = "s1".to_string();
        state.open_session(&session, "main", false);
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
        assert!(state.answer("r1", Some(Answer::Text("secret".into()))));
        assert!(!state.has_pending(&session));
    }
}
