//! Askpass: what the ssh a command starts would ask on a terminal - a
//! passphrase, a host key, a password. The command has none, so
//! `GIT_ASKPASS`/`SSH_ASKPASS` point at this binary. Started that way it asks
//! the running Cogno over the local server (`POST /askpass`) and prints the
//! answer; the server hands the prompt text to the window of the run as a
//! question of the kind `prompt` (`run_questions.rs`).

use super::run_questions::{ask_running_cogno, Asked, RunQuestions};
use tauri::{AppHandle, Manager};

/// The server's route the helper asks on.
pub const ROUTE: &str = "/askpass";
/// The kind of question a prompt text is.
const KIND: &str = "prompt";

/// The server side: asks the window of the run. `None` when it gave no answer.
pub async fn answer(app: &AppHandle, session_id: &str, prompt: String) -> Option<String> {
    let questions = app.state::<RunQuestions>();
    let payload = serde_json::json!({ "text": prompt });
    match questions.ask(app, session_id, KIND, payload).await {
        Asked::Answered(answer) => answer.as_str().map(str::to_string),
        Asked::Refused | Asked::Unanswered => None,
    }
}

/// The helper side: runs in the process git or ssh started, asks the running
/// Cogno and prints the answer. Exit 1 means "no answer", which the caller
/// treats as a refused prompt.
pub fn run_helper(session_id: &str, prompt_args: &[String]) -> i32 {
    let prompt = prompt_args.join(" ");
    let body = serde_json::json!({ "session": session_id, "prompt": prompt });
    let answer = ask_running_cogno(ROUTE, &body);
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
