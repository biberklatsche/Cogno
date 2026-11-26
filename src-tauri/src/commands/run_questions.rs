//! What a process the command runner started asks the window that started
//! it. Such a process has no terminal; whatever it would ask there comes
//! through a helper - this binary under another name - that reaches the
//! running Cogno over the local server (`http_server.rs`). This is the
//! channel from there to the window and back: a question of some kind with a
//! payload, and its answer.
//!
//! The channel knows no kind. Askpass brings what ssh would print
//! (`askpass.rs`), git's credential helper brings credential requests
//! (`sign_ins/helper.rs`); each names its kind and reads its own answer.
//!
//! One runner session is one running command. The caller names its id and
//! says which kinds it answers, so a question nobody would answer never
//! reaches a window. Each session has a token of its own that opens the
//! helpers' endpoints for that session and nothing else. Everything the
//! command starts inherits its environment (hooks in a repository, remote
//! helpers); with the launch token in there, a hook could drive the agent
//! endpoints. With the session token it can at most ask its own run's window.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

/// Names the runner session to the helpers a command starts.
pub const SESSION_ENV: &str = "COGNO_RUN_SESSION";
/// Event to the window: a question to answer.
const QUESTION_EVENT: &str = "run-question";
/// Event to the window: the command ended, the question is moot.
const CLOSED_EVENT: &str = "run-question-closed";
/// How long a question may stay open before the helper gets no answer. The
/// person may take a while; the runner's timeout pauses meanwhile.
const WAIT: std::time::Duration = std::time::Duration::from_secs(30 * 60);
/// How long a helper waits for the server: longer than any question stays
/// open, so the server ends the wait and not the helper.
const HELPER_WAIT: std::time::Duration = std::time::Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Question {
    request_id: String,
    /// The runner session the caller named when it started the command.
    session_id: String,
    kind: String,
    payload: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Closed {
    request_id: String,
}

struct Pending {
    session_id: String,
    window: String,
    answer: oneshot::Sender<Option<Value>>,
}

struct Session {
    /// The window that started the command.
    window: String,
    /// What the run's processes present to the helpers' endpoints.
    token: String,
    /// The kinds of question the run has somebody for.
    answers: Vec<String>,
}

#[derive(Default)]
pub struct RunQuestions {
    sessions: Mutex<HashMap<String, Session>>,
    pending: Mutex<HashMap<String, Pending>>,
}

impl RunQuestions {
    pub fn new() -> Self {
        Self::default()
    }

    /// A command with the caller's session id starts in `window` and answers
    /// questions of the kinds in `answers`. Returns the token its processes
    /// get for the helpers' endpoints.
    pub fn open_session(&self, session_id: &str, window: &str, answers: Vec<String>) -> String {
        let token = uuid::Uuid::new_v4().simple().to_string();
        self.sessions.lock().unwrap().insert(
            session_id.to_string(),
            Session {
                window: window.to_string(),
                token: token.clone(),
                answers,
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

    /// The command ended: questions still open get no answer and the window closes their dialog.
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
            let _ = app.emit_to(entry.window.as_str(), CLOSED_EVENT, Closed { request_id });
        }
    }

    /// Whether a question of this session waits for the user - the runner's timeout pauses then.
    pub fn has_pending(&self, session_id: &str) -> bool {
        self.pending
            .lock()
            .unwrap()
            .values()
            .any(|entry| entry.session_id == session_id)
    }

    /// Asks the session's window a question of `kind` and waits for the
    /// answer. `Unanswered` when the run has nobody for the kind, its window
    /// is gone (closed while the command still ran) or the run is over:
    /// nobody could answer, so the process learns that now rather than after
    /// the full wait. `Refused` when the window said no or did not answer
    /// within `WAIT` - the question is forgotten then, so the run's timeout
    /// counts again.
    pub async fn ask(
        &self,
        app: &AppHandle,
        session_id: &str,
        kind: &str,
        payload: Value,
    ) -> Asked {
        let Some((request_id, receiver)) = self.request(app, session_id, kind, payload) else {
            return Asked::Unanswered;
        };
        let answer = match tokio::time::timeout(WAIT, receiver).await {
            Ok(received) => received.ok().flatten(),
            Err(_) => {
                self.expire(app, &request_id);
                None
            }
        };
        answer.map_or(Asked::Refused, Asked::Answered)
    }

    fn request(
        &self,
        app: &AppHandle,
        session_id: &str,
        kind: &str,
        payload: Value,
    ) -> Option<(String, oneshot::Receiver<Option<Value>>)> {
        let window = {
            let sessions = self.sessions.lock().unwrap();
            let session = sessions.get(session_id)?;
            if !session.answers.iter().any(|answered| answered == kind) {
                return None;
            }
            session.window.clone()
        };
        if app.get_webview_window(&window).is_none() {
            log::warn!(target: "run_questions", "question for a closed window {window}; unanswered");
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
        let _ = app.emit_to(
            window.as_str(),
            QUESTION_EVENT,
            Question {
                request_id: request_id.clone(),
                session_id: session_id.to_string(),
                kind: kind.to_string(),
                payload,
            },
        );
        Some((request_id, receiver))
    }

    /// Nobody answered in time: the question is forgotten, so the run's
    /// timeout counts again, and the window drops its dialog.
    fn expire(&self, app: &AppHandle, request_id: &str) {
        if let Some(entry) = self.forget(request_id) {
            let _ = app.emit_to(
                entry.window.as_str(),
                CLOSED_EVENT,
                Closed {
                    request_id: request_id.to_string(),
                },
            );
        }
    }

    fn forget(&self, request_id: &str) -> Option<Pending> {
        self.pending.lock().unwrap().remove(request_id)
    }

    fn answer(&self, request_id: &str, answer: Option<Value>) -> bool {
        match self.forget(request_id) {
            Some(entry) => entry.answer.send(answer).is_ok(),
            None => false,
        }
    }
}

/// How a question to a run's window ended.
#[derive(Debug, Clone, PartialEq)]
pub enum Asked {
    Answered(Value),
    /// The window said no, or let the question run out.
    Refused,
    /// Nobody could be asked.
    Unanswered,
}

/// The window answers a question; `None` refuses it.
#[tauri::command]
pub fn run_question_answer(
    state: State<'_, RunQuestions>,
    request_id: String,
    answer: Option<Value>,
) -> bool {
    state.answer(&request_id, answer)
}

/// How a helper process reaches the Cogno that started its run: one request
/// to the local server, with the token from its environment. `None` when
/// there is no server to ask or it gave no answer.
pub fn ask_running_cogno(route: &str, body: &Value) -> Option<Value> {
    let port = std::env::var("COGNO_PORT").ok()?;
    let token = std::env::var("COGNO_TOKEN").unwrap_or_default();
    let client = reqwest::blocking::Client::builder()
        .timeout(HELPER_WAIT)
        // The server is on this machine; no proxy has a say.
        .no_proxy()
        .build()
        .ok()?;
    client
        .post(format!("http://127.0.0.1:{port}{route}"))
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

    fn pending(state: &RunQuestions, request_id: &str, session_id: &str) {
        let (sender, _receiver) = oneshot::channel();
        state.pending.lock().unwrap().insert(
            request_id.into(),
            Pending {
                session_id: session_id.into(),
                window: "main".into(),
                answer: sender,
            },
        );
    }

    #[test]
    fn an_answer_for_an_unknown_request_is_refused() {
        let state = RunQuestions::new();
        assert!(!state.answer("nope", Some(Value::from("x"))));
    }

    #[test]
    fn a_session_token_opens_only_its_own_session() {
        let state = RunQuestions::new();
        let first = state.open_session("s1", "main", vec![]);
        let second = state.open_session("s2", "main", vec![]);

        assert!(state.authorizes("s1", &first));
        assert!(state.authorizes("s2", &second));
        assert!(!state.authorizes("s1", &second));
        assert!(!state.authorizes("s3", &first));
        assert!(!state.authorizes("s1", ""));
    }

    #[test]
    fn an_expired_question_no_longer_counts_as_pending() {
        let state = RunQuestions::new();
        state.open_session("s1", "main", vec![]);
        pending(&state, "r1", "s1");

        assert!(state.forget("r1").is_some());

        assert!(!state.has_pending("s1"));
        assert!(!state.answer("r1", Some(Value::from("late"))));
    }

    #[test]
    fn a_session_is_pending_only_while_a_question_is_open() {
        let state = RunQuestions::new();
        state.open_session("s1", "main", vec![]);
        assert!(!state.has_pending("s1"));
        // The receiver must live for the answer to arrive.
        let (sender, _receiver) = oneshot::channel();
        state.pending.lock().unwrap().insert(
            "r1".into(),
            Pending {
                session_id: "s1".into(),
                window: "main".into(),
                answer: sender,
            },
        );

        assert!(state.has_pending("s1"));
        assert!(state.answer("r1", Some(Value::from("secret"))));
        assert!(!state.has_pending("s1"));
    }
}
