//! Which actions `cogno action run` in a terminal may run. The webview pushes
//! the lists (`set_runnable_actions`); the host passes the question from the
//! terminal on (`Question::RunAction`), and it is answered from them at once.

use std::collections::HashSet;
use std::sync::Mutex;

use cogno_host::protocol::ActionRunStatus;
use tauri::State;

/// The action names the webview currently accepts, split by whether they
/// would dispatch or are declared but inactive (a feature that is off).
/// Anything in neither set is unknown.
#[derive(Default)]
pub struct RunnableActionsState {
    dispatched: Mutex<HashSet<String>>,
    inactive: Mutex<HashSet<String>>,
}

impl RunnableActionsState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn classify(&self, name: &str) -> ActionRunStatus {
        if self.dispatched.lock().unwrap().contains(name) {
            ActionRunStatus::Dispatched
        } else if self.inactive.lock().unwrap().contains(name) {
            ActionRunStatus::Inactive
        } else {
            ActionRunStatus::NotFound
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_action_is_dispatched_inactive_or_not_found() {
        let state = RunnableActionsState::new();
        *state.dispatched.lock().unwrap() = ["new_tab".to_string()].into();
        *state.inactive.lock().unwrap() = ["git_panel".to_string()].into();

        assert_eq!(state.classify("new_tab"), ActionRunStatus::Dispatched);
        assert_eq!(state.classify("git_panel"), ActionRunStatus::Inactive);
        assert_eq!(state.classify("nope"), ActionRunStatus::NotFound);
    }
}
