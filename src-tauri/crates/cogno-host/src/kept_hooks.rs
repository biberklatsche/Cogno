//! What the agent in a session's terminal last said through its hooks, kept
//! for a client that attaches later: replayed, it tells that client what the
//! agent does now, as the kept output tells it what the terminal shows.

use std::collections::VecDeque;

use crate::protocol::AgentHook;

/// How much of the hooks' payloads a session keeps: enough for the agent's
/// last turns, not its whole history.
const KEPT_PAYLOAD_BYTES: usize = 256 * 1024;

/// The most recent hooks of one session, oldest first, within a budget of
/// payload bytes.
pub(crate) struct KeptHooks {
    hooks: VecDeque<AgentHook>,
    bytes: usize,
    budget: usize,
}

impl Default for KeptHooks {
    fn default() -> Self {
        Self::with_budget(KEPT_PAYLOAD_BYTES)
    }
}

impl KeptHooks {
    fn with_budget(budget: usize) -> Self {
        Self {
            hooks: VecDeque::new(),
            bytes: 0,
            budget,
        }
    }

    /// Keeps `hook`, dropping the oldest ones it does not leave room for. A
    /// hook bigger than the whole budget is not kept: it would push out
    /// everything else.
    pub fn keep(&mut self, hook: &AgentHook) {
        let size = hook.payload.len();
        if size > self.budget {
            return;
        }
        while self.bytes + size > self.budget {
            match self.hooks.pop_front() {
                Some(oldest) => self.bytes -= oldest.payload.len(),
                None => break,
            }
        }
        self.bytes += size;
        self.hooks.push_back(hook.clone());
    }

    /// The kept hooks, oldest first.
    pub fn iter(&self) -> impl Iterator<Item = &AgentHook> {
        self.hooks.iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hook(event: &str, payload_len: usize) -> AgentHook {
        AgentHook {
            terminal_id: Some("t1".into()),
            provider: "codex".into(),
            event: event.into(),
            sent_at: 0,
            payload: "x".repeat(payload_len),
        }
    }

    fn events(kept: &KeptHooks) -> Vec<&str> {
        kept.iter().map(|hook| hook.event.as_str()).collect()
    }

    #[test]
    fn keeps_the_newest_hooks_within_the_budget() {
        let mut kept = KeptHooks::with_budget(10);
        kept.keep(&hook("a", 4));
        kept.keep(&hook("b", 4));
        kept.keep(&hook("c", 4));

        assert_eq!(events(&kept), ["b", "c"]);
    }

    #[test]
    fn a_hook_bigger_than_the_budget_pushes_nothing_out() {
        let mut kept = KeptHooks::with_budget(10);
        kept.keep(&hook("a", 4));
        kept.keep(&hook("huge", 11));

        assert_eq!(events(&kept), ["a"]);
    }
}
