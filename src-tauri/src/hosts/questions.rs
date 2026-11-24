//! Questions a host passes on to this app (`Event::Asked`), and their
//! answers: `cogno action run` typed in a terminal this app shows, and the
//! prompts of git and ssh that this app started. What they say is this app's
//! own format (`relayed`); the host only told whom they are for.

use cogno_host::protocol::{Addressee, RelayId};
use tauri::{AppHandle, Manager};

use crate::cli::{action_payload, CLI_ACTION_EVENT};
use crate::commands::askpass;
use crate::commands::window_registry::route;
use crate::host_connection::Answers;
use crate::relayed::{self, ActionRunStatus, Answer, Question};
use crate::runnable_actions::RunnableActionsState;

/// Answers `question`, now or - for a prompt the user has to answer - later.
/// Every question gets an answer: the one asking waits for it.
pub fn answer(app: &AppHandle, relay: RelayId, to: Addressee, question: &str, answers: &Answers) {
    let answer_with = |answer: Answer| answers.answer(relay, relayed::encode(&answer));
    match (to, relayed::decode(question)) {
        (Addressee::Terminal { terminal_id }, Some(Question::RunAction { name, args })) => {
            let status = app.state::<RunnableActionsState>().classify(&name);
            if status == ActionRunStatus::Dispatched {
                // In the window of the terminal it was typed in.
                let action = action_payload(&name, &args);
                route(app, CLI_ACTION_EVENT, action, Some(&terminal_id));
            }
            answer_with(Answer::ActionRun { status });
        }
        (Addressee::PromptSession { session }, Some(Question::Prompt { token, prompt })) => {
            let app = app.clone();
            let answers = answers.clone();
            tauri::async_runtime::spawn(async move {
                let answer = askpass::ask_window(&app, &session, &token, prompt).await;
                answers.answer(relay, relayed::encode(&Answer::Prompt { answer }));
            });
        }
        // Asked of something this Cogno does not know, or in words it does
        // not know: said at once, so the one asking does not wait in vain.
        _ => answer_with(Answer::Unknown),
    }
}
