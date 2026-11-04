use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::pty::PtyState;

/// Emit `event` to the window that owns `terminal_id` (or the last-focused
/// window when no terminal is given or known), falling back to a broadcast
/// when no target window is known yet. A terminal's window is known by its
/// PTY alone, which carries the window that spawned it (ARCHITECTURE.md 2.6).
/// This is the only window-routing code that touches Tauri.
pub fn route<P: Serialize + Clone>(
    app: &AppHandle,
    event: &str,
    payload: P,
    terminal_id: Option<&str>,
) {
    let target = terminal_id
        .and_then(|id| app.state::<PtyState>().window_of(id))
        .or_else(|| app.state::<WindowRegistry>().last_focused());
    match target {
        Some(label) => {
            let _ = app.emit_to(label, event, payload);
        }
        None => {
            let _ = app.emit(event, payload);
        }
    }
}

/// Maps workspaces to the window that holds them, and remembers which window
/// was focused last. Which window a terminal belongs to is its PTY's to say. Backend events are then routed to a single
/// window instead of broadcast to all of them (ARCHITECTURE.md 2.6).
///
/// Plain state on purpose: it holds only ids and labels, so the routing logic
/// is unit-tested without a running Tauri app. Only the thin `route` helper in
/// the app layer touches `AppHandle`/`emit_to`.
#[derive(Default)]
pub struct WindowRegistry {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    workspace_to_label: HashMap<String, String>,
    last_focused: Option<String>,
}

impl WindowRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record `label` as the most recently focused window.
    pub fn set_focus(&self, label: &str) {
        self.inner.lock().unwrap().last_focused = Some(label.to_string());
    }

    /// Claim a workspace for `label`. Fails with the holding label when another
    /// window already holds it, so the caller can focus that window instead.
    pub fn claim_workspace(&self, workspace_id: &str, label: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        if let Some(holder) = inner.workspace_to_label.get(workspace_id) {
            if holder != label {
                return Err(holder.clone());
            }
        }
        inner
            .workspace_to_label
            .insert(workspace_id.to_string(), label.to_string());
        Ok(())
    }

    /// Release a workspace, but only if `label` currently holds it.
    pub fn release_workspace(&self, workspace_id: &str, label: &str) {
        let mut inner = self.inner.lock().unwrap();
        if inner
            .workspace_to_label
            .get(workspace_id)
            .map(String::as_str)
            == Some(label)
        {
            inner.workspace_to_label.remove(workspace_id);
        }
    }

    /// Drop everything a destroyed window owned.
    pub fn on_destroyed(&self, label: &str) {
        let mut inner = self.inner.lock().unwrap();
        inner.workspace_to_label.retain(|_, owner| owner != label);
        if inner.last_focused.as_deref() == Some(label) {
            inner.last_focused = None;
        }
    }

    pub fn label_for_workspace(&self, workspace_id: &str) -> Option<String> {
        self.inner
            .lock()
            .unwrap()
            .workspace_to_label
            .get(workspace_id)
            .cloned()
    }

    /// The window focused last: where an event without a terminal goes.
    pub fn last_focused(&self) -> Option<String> {
        self.inner.lock().unwrap().last_focused.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::WindowRegistry;

    #[test]
    fn remembers_the_window_focused_last() {
        let registry = WindowRegistry::new();
        assert_eq!(registry.last_focused(), None);
        registry.set_focus("win-a");
        registry.set_focus("win-b");
        assert_eq!(registry.last_focused().as_deref(), Some("win-b"));
    }

    #[test]
    fn claim_conflicts_when_another_window_holds_the_workspace() {
        let registry = WindowRegistry::new();
        registry.claim_workspace("ws1", "win-a").unwrap();

        // same window can re-claim
        assert_eq!(registry.claim_workspace("ws1", "win-a"), Ok(()));
        // another window is refused with the holder's label
        assert_eq!(
            registry.claim_workspace("ws1", "win-b"),
            Err("win-a".to_string())
        );
        // holder unchanged after a refused claim
        assert_eq!(
            registry.label_for_workspace("ws1").as_deref(),
            Some("win-a")
        );
    }

    #[test]
    fn release_only_by_the_holder() {
        let registry = WindowRegistry::new();
        registry.claim_workspace("ws1", "win-a").unwrap();

        registry.release_workspace("ws1", "win-b"); // not the holder: no-op
        assert_eq!(
            registry.label_for_workspace("ws1").as_deref(),
            Some("win-a")
        );

        registry.release_workspace("ws1", "win-a");
        assert_eq!(registry.label_for_workspace("ws1"), None);
        // freed workspace can be claimed by another window
        assert_eq!(registry.claim_workspace("ws1", "win-b"), Ok(()));
    }

    #[test]
    fn destroyed_window_drops_all_its_entries() {
        let registry = WindowRegistry::new();
        registry.claim_workspace("ws1", "win-a").unwrap();
        registry.set_focus("win-a");

        registry.on_destroyed("win-a");

        assert_eq!(registry.label_for_workspace("ws1"), None);
        assert_eq!(registry.last_focused(), None);
    }
}
