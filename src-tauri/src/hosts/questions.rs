//! Questions a host passes on to this app (`Event::Asked`), and their
//! answers: `cogno action run` typed in a terminal this app shows, and the
//! prompts of git and ssh that this app started.

use cogno_host::protocol::{ActionRunStatus, Answer, Question, RelayId};
use tauri::{AppHandle, Manager};

use crate::commands::askpass;
use crate::commands::window_registry::route;
use crate::host_connection::Answers;
use crate::runnable_actions::RunnableActionsState;

/// The webview event an action from the command line arrives as.
const CLI_ACTION_EVENT: &str = "cli-action";

/// Answers `question`, now or - for a prompt the user has to answer - later.
pub fn answer(app: &AppHandle, relay: RelayId, question: Question, answers: &Answers) {
    match question {
        Question::RunAction {
            terminal_id,
            name,
            args,
        } => {
            let status = app.state::<RunnableActionsState>().classify(&name);
            if status == ActionRunStatus::Dispatched {
                // `name[:arg...]`, as the webview parses it; in the window of
                // the terminal it was typed in.
                let action = std::iter::once(name)
                    .chain(args)
                    .collect::<Vec<_>>()
                    .join(":");
                route(app, CLI_ACTION_EVENT, action, Some(&terminal_id));
            }
            answers.answer(relay, Answer::ActionRun { status });
        }
        Question::Prompt {
            session,
            token,
            prompt,
        } => {
            let app = app.clone();
            let answers = answers.clone();
            tauri::async_runtime::spawn(async move {
                let answer = askpass::ask_window(&app, &session, &token, prompt).await;
                answers.answer(relay, Answer::Prompt { answer });
            });
        }
        // The host passes on no question it does not know.
        Question::Unknown => {}
    }
}
