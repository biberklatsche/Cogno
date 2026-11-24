//! Prompts from processes this app starts (git through the command runner,
//! and the ssh git runs): they get no terminal, so `GIT_ASKPASS` and
//! `SSH_ASKPASS` point at this binary, which asks through the host of this
//! machine (`Question::Prompt`) and prints the answer. The app owns the
//! prompts of a session while its command runs (`Request::OwnPrompts`), so the
//! host passes them on to this app and no other; the window that started the
//! command asks the user. One session is one running command; the caller
//! names its id, so the window can hand the prompt to whoever started it.
//!
//! Each session has a token of its own, and the app answers a prompt only
//! with it: everything git starts inherits the run's environment (hooks in
//! the repository, remote helpers, the credential helper), and the token lets
//! such a process at most ask its own run's window.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

/// The variable that turns this binary into the askpass helper.
pub const SESSION_ENV: &str = "COGNO_ASKPASS_SESSION";
/// The session's token, which the helper presents with its prompt.
pub const TOKEN_ENV: &str = "COGNO_ASKPASS_TOKEN";
/// Where ssh asks when it has no terminal, and whether it does so even when
/// it has one.
pub const SSH_ASKPASS_ENV: &str = "SSH_ASKPASS";
pub const SSH_ASKPASS_REQUIRE_ENV: &str = "SSH_ASKPASS_REQUIRE";
/// How long a prompt waits for the user before it counts as refused.
const ASKPASS_WAIT: std::time::Duration = std::time::Duration::from_secs(30 * 60);
/// Event to the window: show a prompt.
pub const REQUEST_EVENT: &str = "askpass-request";
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
pub struct AskpassClosed {
    pub request_id: String,
}

struct Pending {
    session_id: String,
    window: String,
    answer: oneshot::Sender<Option<String>>,
}

struct Session {
    /// The window that started the command.
    window: String,
    /// What the run's processes present with a prompt.
    token: String,
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
    /// the token its processes present with a prompt.
    pub fn open_session(&self, session_id: &str, window: &str) -> String {
        let token = uuid::Uuid::new_v4().simple().to_string();
        self.sessions.lock().unwrap().insert(
            session_id.to_string(),
            Session {
                window: window.to_string(),
                token: token.clone(),
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

    /// Ask the session's window; `None` when the session is unknown or its
    /// window is gone (closed while the command still ran): nobody could
    /// answer, so the process gets its refusal now rather than after the
    /// full prompt time.
    pub fn request(
        &self,
        app: &AppHandle,
        session_id: &str,
        prompt: String,
    ) -> Option<(String, oneshot::Receiver<Option<String>>)> {
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
        let _ = app.emit_to(
            window.as_str(),
            REQUEST_EVENT,
            AskpassRequest {
                request_id: request_id.clone(),
                session_id: session_id.to_string(),
                prompt,
            },
        );
        Some((request_id, receiver))
    }

    /// Nobody answered in time: the prompt is forgotten, so the run's
    /// timeout counts again, and the window drops its dialog.
    pub fn expire(&self, app: &AppHandle, request_id: &str) {
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

    fn answer(&self, request_id: &str, answer: Option<String>) -> bool {
        match self.forget(request_id) {
            Some(entry) => entry.answer.send(answer).is_ok(),
            None => false,
        }
    }
}

/// Asks the user in the window of `session`, for a prompt the host passed
/// on: `None` when the token is not the session's, nobody could answer, or
/// nobody did in time.
pub async fn ask_window(
    app: &AppHandle,
    session: &str,
    token: &str,
    prompt: String,
) -> Option<String> {
    let askpass = app.state::<AskpassState>();
    if !askpass.authorizes(session, token) {
        log::warn!(target: "askpass", "a prompt with a wrong token; refused");
        return None;
    }
    let (request_id, receiver) = askpass.request(app, session, prompt)?;
    // The user may take a while; the helper waits, and the runner's timeout pauses.
    match tokio::time::timeout(ASKPASS_WAIT, receiver).await {
        Ok(received) => received.ok().flatten(),
        Err(_) => {
            askpass.expire(app, &request_id);
            None
        }
    }
}

/// Makes ssh ask through this binary instead of a terminal it does not have:
/// `session_id` and `token` are what `open_session` took and gave. The helper
/// is told this app's host (`COGNO_HOST`), whatever environment the app
/// itself was started in. Returns the helper, or `None` when there is none to
/// point at and the process is left as it is.
pub fn point_ssh_at_helper(
    command: &mut std::process::Command,
    session_id: &str,
    token: &str,
) -> Option<std::path::PathBuf> {
    let helper = std::env::current_exe().ok()?;
    let host = crate::host_endpoint::own_host_endpoint().ok()?;
    command.env(SSH_ASKPASS_ENV, &helper);
    command.env(SSH_ASKPASS_REQUIRE_ENV, "force");
    command.env(SESSION_ENV, session_id);
    command.env(TOKEN_ENV, token);
    command.env(cogno_host::env_vars::COGNO_HOST, host);
    Some(helper)
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

/// The helper side: runs in the process git or ssh started, asks through the
/// host of this machine and prints the answer. Exit 1 means "no answer",
/// which the caller treats as a refused prompt.
pub fn run_helper(session_id: &str, prompt_args: &[String]) -> i32 {
    use crate::relayed::{self, Answer, Question};
    use cogno_host::protocol::Addressee;

    let Ok(endpoint) = crate::host_endpoint::host_endpoint() else {
        return 1;
    };
    let to = Addressee::PromptSession {
        session: session_id.to_string(),
    };
    let question = relayed::encode(&Question::Prompt {
        token: std::env::var(TOKEN_ENV).unwrap_or_default(),
        prompt: prompt_args.join(" "),
    });
    // As long as the user takes: the app gives up on its own (`ASKPASS_WAIT`).
    let answered = cogno_host::once::ask(&endpoint, to, question, None);
    match answered.ok().and_then(|answer| relayed::decode(&answer)) {
        Some(Answer::Prompt {
            answer: Some(answer),
        }) => {
            println!("{answer}");
            0
        }
        _ => 1,
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
    fn a_session_token_opens_only_its_own_session() {
        let state = AskpassState::new();
        let first = state.open_session("s1", "main");
        let second = state.open_session("s2", "main");

        assert!(state.authorizes("s1", &first));
        assert!(state.authorizes("s2", &second));
        assert!(!state.authorizes("s1", &second));
        assert!(!state.authorizes("s3", &first));
        assert!(!state.authorizes("s1", ""));
    }

    #[test]
    fn an_expired_prompt_no_longer_counts_as_pending() {
        let state = AskpassState::new();
        state.open_session("s1", "main");
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
        assert!(!state.answer("r1", Some("late".into())));
    }

    #[test]
    fn a_session_is_pending_only_while_a_prompt_is_open() {
        let state = AskpassState::new();
        let session = "s1".to_string();
        state.open_session(&session, "main");
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
