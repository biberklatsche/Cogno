//! Which actions `cogno action run` in a terminal may run. The webview pushes
//! the lists (`set_runnable_actions`); the host passes the question from the
//! terminal on (`Question::RunAction`), and it is answered from them at once.

use std::collections::HashSet;
use std::sync::Mutex;

use cogno_host::sync::lock;
use tauri::State;

use crate::relayed::ActionRunStatus;

/// The action names the webview currently accepts, split by whether they
/// would dispatch or are declared but inactive (a feature that is off).
/// Anything in neither set is unknown.
#[derive(Default)]
struct RunnableActions {
    dispatched: HashSet<String>,
    inactive: HashSet<String>,
}

/// Both lists under one lock: an update is seen whole or not at all.
#[derive(Default)]
pub struct RunnableActionsState(Mutex<RunnableActions>);

impl RunnableActionsState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn classify(&self, name: &str) -> ActionRunStatus {
        let actions = lock(&self.0);
        if actions.dispatched.contains(name) {
            ActionRunStatus::Dispatched
        } else if actions.inactive.contains(name) {
            ActionRunStatus::Inactive
        } else {
            ActionRunStatus::NotFound
        }
    }

    fn set(&self, dispatched: Vec<String>, inactive: Vec<String>) {
        *lock(&self.0) = RunnableActions {
            dispatched: dispatched.into_iter().collect(),
            inactive: inactive.into_iter().collect(),
        };
    }
}

/// The webview reports which actions are dispatchable vs inactive right now.
#[tauri::command]
pub fn set_runnable_actions(
    state: State<'_, RunnableActionsState>,
    dispatched: Vec<String>,
    inactive: Vec<String>,
) {
    state.set(dispatched, inactive);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_action_is_dispatched_inactive_or_not_found() {
        let state = RunnableActionsState::new();
        state.set(vec!["new_tab".into()], vec!["git_panel".into()]);

        assert_eq!(state.classify("new_tab"), ActionRunStatus::Dispatched);
        assert_eq!(state.classify("git_panel"), ActionRunStatus::Inactive);
        assert_eq!(state.classify("nope"), ActionRunStatus::NotFound);
    }
}
