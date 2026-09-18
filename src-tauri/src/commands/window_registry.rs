use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// Emit `event` to the window that owns `terminal_id` (or the last-focused
/// window when no terminal is given or known), falling back to a broadcast
/// when no target window is known yet. This is the only window-routing code
/// that touches Tauri; the resolution it relies on lives on the (pure,
/// unit-tested) registry.
pub fn route<P: Serialize + Clone>(
    app: &AppHandle,
    event: &str,
    payload: P,
    terminal_id: Option<&str>,
) {
    match app.state::<WindowRegistry>().resolve_target(terminal_id) {
        Some(label) => {
            let _ = app.emit_to(label, event, payload);
        }
        None => {
            let _ = app.emit(event, payload);
        }
    }
}

/// Maps sessions and workspaces to the window that owns them, and remembers
/// which window was focused last. Backend events are then routed to a single
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
    terminal_to_label: HashMap<String, String>,
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

    /// Bind a session to the window that spawned it.
    pub fn bind_terminal(&self, terminal_id: &str, label: &str) {
        self.inner
            .lock()
            .unwrap()
            .terminal_to_label
            .insert(terminal_id.to_string(), label.to_string());
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
        inner.terminal_to_label.retain(|_, owner| owner != label);
        inner.workspace_to_label.retain(|_, owner| owner != label);
        if inner.last_focused.as_deref() == Some(label) {
            inner.last_focused = None;
        }
    }

    pub fn label_for_terminal(&self, terminal_id: &str) -> Option<String> {
        self.inner
            .lock()
            .unwrap()
            .terminal_to_label
            .get(terminal_id)
            .cloned()
    }

    pub fn label_for_workspace(&self, workspace_id: &str) -> Option<String> {
        self.inner
            .lock()
            .unwrap()
            .workspace_to_label
            .get(workspace_id)
            .cloned()
    }

    pub fn last_focused(&self) -> Option<String> {
        self.inner.lock().unwrap().last_focused.clone()
    }

    /// The window an event should go to: the session's window when a known
    /// `terminal_id` is given, otherwise the last-focused window.
    pub fn resolve_target(&self, terminal_id: Option<&str>) -> Option<String> {
        let inner = self.inner.lock().unwrap();
        if let Some(id) = terminal_id {
            if let Some(label) = inner.terminal_to_label.get(id) {
                return Some(label.clone());
            }
        }
        inner.last_focused.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::WindowRegistry;

    #[test]
    fn maps_terminals_and_workspaces_and_focus() {
        let registry = WindowRegistry::new();
        registry.bind_terminal("t1", "win-a");
        registry.set_focus("win-b");
        registry.claim_workspace("ws1", "win-a").unwrap();

        assert_eq!(registry.label_for_terminal("t1").as_deref(), Some("win-a"));
        assert_eq!(registry.label_for_terminal("nope"), None);
        assert_eq!(
            registry.label_for_workspace("ws1").as_deref(),
            Some("win-a")
        );
        assert_eq!(registry.last_focused().as_deref(), Some("win-b"));
    }

    #[test]
    fn resolves_target_by_terminal_then_falls_back_to_focus() {
        let registry = WindowRegistry::new();
        registry.bind_terminal("t1", "win-a");
        registry.set_focus("win-b");

        // known terminal -> its window
        assert_eq!(
            registry.resolve_target(Some("t1")).as_deref(),
            Some("win-a")
        );
        // unknown terminal -> last focused
        assert_eq!(
            registry.resolve_target(Some("unknown")).as_deref(),
            Some("win-b")
        );
        // no terminal -> last focused
        assert_eq!(registry.resolve_target(None).as_deref(), Some("win-b"));
    }

    #[test]
    fn resolves_to_none_without_focus_or_binding() {
        let registry = WindowRegistry::new();
        assert_eq!(registry.resolve_target(None), None);
        assert_eq!(registry.resolve_target(Some("t1")), None);
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
        registry.bind_terminal("t1", "win-a");
        registry.bind_terminal("t2", "win-b");
        registry.claim_workspace("ws1", "win-a").unwrap();
        registry.set_focus("win-a");

        registry.on_destroyed("win-a");

        assert_eq!(registry.label_for_terminal("t1"), None);
        assert_eq!(registry.label_for_terminal("t2").as_deref(), Some("win-b"));
        assert_eq!(registry.label_for_workspace("ws1"), None);
        assert_eq!(registry.last_focused(), None);
    }
}
