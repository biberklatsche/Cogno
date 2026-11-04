use std::time::{SystemTime, UNIX_EPOCH};
use tauri::window::Color;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

use super::window_registry::WindowRegistry;

#[derive(Default)]
pub struct QuitState {
    running: tokio::sync::Mutex<bool>,
    replies: std::sync::Mutex<
        std::collections::HashMap<String, tokio::sync::oneshot::Sender<Result<bool, String>>>,
    >,
}

impl QuitState {
    fn begin_window_creation(&self) -> Result<tokio::sync::MutexGuard<'_, bool>, String> {
        let guard = self.running.try_lock().map_err(|_| {
            "Cogno is preparing to quit. Try again after cancelling quit.".to_string()
        })?;
        if *guard {
            return Err("Cogno is quitting.".to_string());
        }
        Ok(guard)
    }
    pub fn cancel_window(&self, label: &str) {
        let prefix = format!("{label}:");
        self.replies
            .lock()
            .unwrap()
            .retain(|key, _| !key.starts_with(&prefix));
    }
}

async fn await_quit_reply(
    reply: tokio::sync::oneshot::Receiver<Result<bool, String>>,
    timeout: std::time::Duration,
) -> Result<bool, String> {
    tokio::time::timeout(timeout, reply)
        .await
        .map_err(|_| {
            "A window did not respond. Cogno remains open; please try quitting again.".to_string()
        })?
        .map_err(|_| "A window closed while preparing to quit. Please try again.".to_string())?
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QuitRequest {
    request_id: String,
    phase: &'static str,
}

/// Rust alone enumerates windows. Confirm everywhere before any shutdown writes.
#[tauri::command]
pub async fn window_prepare_quit(
    app: tauri::AppHandle,
    state: State<'_, QuitState>,
) -> Result<bool, String> {
    use tauri::Emitter;
    let Ok(mut guard) = state.running.try_lock() else {
        return Ok(false);
    };
    if *guard {
        return Ok(false);
    }
    let windows: Vec<_> = app.webview_windows().into_values().collect();
    for phase in ["confirm", "persist"] {
        for window in &windows {
            if app.get_webview_window(window.label()).is_none() {
                continue;
            }
            let request_id = uuid::Uuid::new_v4().to_string();
            let key = format!("{}:{}", window.label(), request_id);
            let (tx, rx) = tokio::sync::oneshot::channel();
            state.replies.lock().unwrap().insert(key.clone(), tx);
            let sent = window.emit("cogno-prepare-quit", QuitRequest { request_id, phase });
            let accepted = if sent.is_ok() {
                // Dialogs need user time; persistence has a 3 s frontend budget.
                let seconds = if phase == "confirm" { 300 } else { 10 };
                await_quit_reply(rx, std::time::Duration::from_secs(seconds)).await
            } else {
                Err("Could not contact a window. Cogno remains open.".to_string())
            };
            state.replies.lock().unwrap().remove(&key);
            if !accepted? {
                return Ok(false);
            }
        }
    }
    // Keep window creation closed until process exit, including after returning.
    *guard = true;
    app.exit(0);
    Ok(true)
}

#[tauri::command]
pub fn window_answer_quit(
    window: tauri::WebviewWindow,
    state: State<'_, QuitState>,
    request_id: String,
    accepted: bool,
    error: Option<String>,
) {
    let key = format!("{}:{}", window.label(), request_id);
    if let Some(reply) = state.replies.lock().unwrap().remove(&key) {
        let _ = reply.send(match error {
            Some(message) => Err(message),
            None => Ok(accepted),
        });
    }
}

#[tauri::command]
pub async fn new_window(app: tauri::AppHandle, state: State<'_, QuitState>) -> Result<(), String> {
    let _guard = state.begin_window_creation()?;
    // Generate a unique label for the new window
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let label = format!("win-{}", millis);

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::default())
        .title("")
        .inner_size(800.0, 600.0)
        .background_color(Color(0x0e, 0x19, 0x25, 0xff))
        .visible(false);

    #[cfg(target_os = "macos")]
    let win_builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);

    #[cfg(not(target_os = "macos"))]
    let win_builder = builder.decorations(false);

    let window = win_builder.build().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}

/// Claim a workspace for this window. If another window already holds it, that
/// window is focused instead and its label comes back, so a workspace is only
/// ever open in one window. `None` means the claim succeeded; a held workspace
/// is an answer, not an error.
#[tauri::command]
pub fn window_claim_workspace(
    window: tauri::WebviewWindow,
    registry: State<'_, WindowRegistry>,
    workspace_id: String,
) -> Option<String> {
    let holder = registry
        .claim_workspace(&workspace_id, window.label())
        .err()?;
    if let Some(other) = window.app_handle().get_webview_window(&holder) {
        let _ = other.show();
        let _ = other.unminimize();
        let _ = other.set_focus();
    }
    Some(holder)
}

/// Release a workspace this window holds.
#[tauri::command]
pub fn window_release_workspace(
    window: tauri::WebviewWindow,
    registry: State<'_, WindowRegistry>,
    workspace_id: String,
) {
    registry.release_workspace(&workspace_id, window.label());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn destroying_a_window_cancels_only_its_pending_quit_reply() {
        let state = QuitState::default();
        let (a, mut a_reply) = tokio::sync::oneshot::channel();
        let (b, mut b_reply) = tokio::sync::oneshot::channel();
        state
            .replies
            .lock()
            .unwrap()
            .insert("win-a:request".into(), a);
        state
            .replies
            .lock()
            .unwrap()
            .insert("win-b:request".into(), b);
        state.cancel_window("win-a");
        assert!(matches!(
            a_reply.try_recv(),
            Err(tokio::sync::oneshot::error::TryRecvError::Closed)
        ));
        assert!(matches!(
            b_reply.try_recv(),
            Err(tokio::sync::oneshot::error::TryRecvError::Empty)
        ));
        assert_eq!(state.replies.lock().unwrap().len(), 1);
    }

    #[test]
    fn only_one_quit_can_run_at_a_time() {
        let state = QuitState::default();
        let guard = state.running.try_lock().unwrap();
        assert!(state.running.try_lock().is_err());
        drop(guard);
        assert!(state.running.try_lock().is_ok());
    }

    #[test]
    fn window_creation_is_blocked_during_quit_and_after_commit() {
        let state = QuitState::default();
        let mut quit = state.running.try_lock().unwrap();
        assert!(state.begin_window_creation().is_err());
        *quit = true;
        drop(quit);
        assert!(state.begin_window_creation().is_err());
        *state.running.try_lock().unwrap() = false;
        assert!(state.begin_window_creation().is_ok());
    }

    #[test]
    fn quit_and_window_creation_cannot_overlap() {
        let state = QuitState::default();
        let creation = state.begin_window_creation().unwrap();
        assert!(state.running.try_lock().is_err());
        drop(creation);
        assert!(state.running.try_lock().is_ok());
    }

    #[test]
    fn missing_reply_is_an_error_but_user_cancellation_is_not() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .unwrap();
        runtime.block_on(async {
            let (_sender, reply) = tokio::sync::oneshot::channel();
            assert!(await_quit_reply(reply, std::time::Duration::ZERO)
                .await
                .unwrap_err()
                .contains("did not respond"));
            let (sender, reply) = tokio::sync::oneshot::channel();
            sender.send(Ok(false)).unwrap();
            assert!(!await_quit_reply(reply, std::time::Duration::from_secs(1))
                .await
                .unwrap());
            let (sender, reply) = tokio::sync::oneshot::channel();
            sender.send(Err("Save failed".into())).unwrap();
            assert_eq!(
                await_quit_reply(reply, std::time::Duration::from_secs(1)).await,
                Err("Save failed".into())
            );
        });
    }
}
