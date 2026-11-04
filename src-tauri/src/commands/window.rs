use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::window::Color;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

use super::window_registry::WindowRegistry;

/// The event a window gets a quit request by.
const QUIT_REQUEST_EVENT: &str = "cogno-prepare-quit";
/// How long a window may take to say it got a request. One that stays silent
/// is loading or hung and is not waited for: quitting wins.
const QUIT_RECEIVED_TIMEOUT: Duration = Duration::from_secs(5);
/// Persistence has a 3 s frontend budget; a window past this is not waited for.
const QUIT_PERSIST_TIMEOUT: Duration = Duration::from_secs(10);

/// What a window sends back for a quit request: that it got it, then its answer.
enum QuitMessage {
    Received,
    Answer(bool),
}

/// A request a window has not answered yet.
struct PendingQuit {
    window: String,
    messages: UnboundedSender<QuitMessage>,
}

/// Quitting wins (ARCHITECTURE.md 2.6): only a user's "no" keeps Cogno open.
/// A window that stays silent, closes, or fails counts as "yes".
#[derive(Default)]
pub struct QuitState {
    /// A quit is being prepared or was committed. Window creation is refused
    /// meanwhile; after the commit it stays refused until the process is gone.
    quitting: Mutex<bool>,
    /// By request id.
    pending: Mutex<HashMap<String, PendingQuit>>,
}

/// Ends the quit when dropped, unless it was committed.
struct QuitAttempt<'a> {
    state: &'a QuitState,
    committed: bool,
}

impl Drop for QuitAttempt<'_> {
    fn drop(&mut self) {
        if !self.committed {
            *self.state.quitting_lock() = false;
        }
    }
}

/// A request sent to one window; dropping it forgets the request.
struct AskedWindow<'a> {
    state: &'a QuitState,
    request_id: String,
    messages: UnboundedReceiver<QuitMessage>,
}

impl AskedWindow<'_> {
    /// The window's answer. Without `answer_timeout` the answer is waited for
    /// as long as the window lives: its dialog is open, the user decides.
    async fn answer(mut self, answer_timeout: Option<Duration>) -> bool {
        await_quit_reply(&mut self.messages, QUIT_RECEIVED_TIMEOUT, answer_timeout).await
    }
}

impl Drop for AskedWindow<'_> {
    fn drop(&mut self) {
        self.state.pending_lock().remove(&self.request_id);
    }
}

impl QuitState {
    fn quitting_lock(&self) -> MutexGuard<'_, bool> {
        self.quitting
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn pending_lock(&self) -> MutexGuard<'_, HashMap<String, PendingQuit>> {
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// No new window while quitting: it would miss the confirmation.
    fn refuse_while_quitting(&self) -> Result<(), String> {
        if *self.quitting_lock() {
            return Err("Cogno is quitting.".to_string());
        }
        Ok(())
    }

    /// `None` when a quit already runs: its dialogs are open, a second press
    /// adds nothing.
    fn begin_quit(&self) -> Option<QuitAttempt<'_>> {
        let mut quitting = self.quitting_lock();
        if *quitting {
            return None;
        }
        *quitting = true;
        Some(QuitAttempt {
            state: self,
            committed: false,
        })
    }

    /// Sends `phase` to the window. `None` when the window is gone or cannot
    /// be reached: it has nothing to say then.
    fn ask<'a>(
        &'a self,
        app: &tauri::AppHandle,
        window: &str,
        phase: &'static str,
    ) -> Option<AskedWindow<'a>> {
        app.get_webview_window(window)?;
        let request_id = uuid::Uuid::new_v4().to_string();
        let (sender, messages) = unbounded_channel();
        self.pending_lock().insert(
            request_id.clone(),
            PendingQuit {
                window: window.to_string(),
                messages: sender,
            },
        );
        let asked = AskedWindow {
            state: self,
            request_id: request_id.clone(),
            messages,
        };
        // To this window only: `emit` reaches every window.
        if let Err(error) = app.emit_to(
            window,
            QUIT_REQUEST_EVENT,
            QuitRequest { request_id, phase },
        ) {
            log::warn!(target: "window", "quit: cannot reach window {window}: {error}");
            return None;
        }
        Some(asked)
    }

    /// Passes a window's message on, if the request is this window's.
    fn deliver(&self, window: &str, request_id: &str, message: QuitMessage) {
        if let Some(pending) = self.pending_lock().get(request_id) {
            if pending.window == window {
                let _ = pending.messages.send(message);
            }
        }
    }

    pub fn cancel_window(&self, label: &str) {
        self.pending_lock()
            .retain(|_, pending| pending.window != label);
    }
}

/// Waits for a window to confirm receipt, then for its answer; an answer
/// without a receipt counts as both. A window that stays silent past
/// `received_timeout` or `answer_timeout`, or closes meanwhile, has said yes.
async fn await_quit_reply(
    messages: &mut UnboundedReceiver<QuitMessage>,
    received_timeout: Duration,
    answer_timeout: Option<Duration>,
) -> bool {
    let mut deadline = Some(tokio::time::Instant::now() + received_timeout);
    loop {
        let message = match deadline {
            Some(at) => match tokio::time::timeout_at(at, messages.recv()).await {
                Ok(message) => message,
                Err(_) => return true,
            },
            None => messages.recv().await,
        };
        match message {
            Some(QuitMessage::Answer(accepted)) => return accepted,
            Some(QuitMessage::Received) => {
                deadline = answer_timeout.map(|timeout| tokio::time::Instant::now() + timeout);
            }
            None => return true,
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QuitRequest {
    request_id: String,
    phase: &'static str,
}

/// Rust alone enumerates windows. One window after the other confirms (each
/// may ask the user), then all save at once, then the process ends - whatever
/// a window failed to do on the way. False only when a user said no. The
/// `Result` is Tauri's: an async command with `State` must return one; it
/// never errs.
#[tauri::command]
pub async fn window_prepare_quit(
    app: tauri::AppHandle,
    state: State<'_, QuitState>,
) -> Result<bool, String> {
    let Some(mut attempt) = state.begin_quit() else {
        return Ok(false);
    };
    let windows: Vec<String> = app.webview_windows().into_keys().collect();

    for window in &windows {
        if let Some(asked) = state.ask(&app, window, "confirm") {
            if !asked.answer(None).await {
                return Ok(false);
            }
        }
    }

    let saving: Vec<_> = windows
        .iter()
        .filter_map(|window| state.ask(&app, window, "persist"))
        .collect();
    for asked in saving {
        asked.answer(Some(QUIT_PERSIST_TIMEOUT)).await;
    }

    attempt.committed = true;
    app.exit(0);
    Ok(true)
}

/// A window got a quit request and is working on it.
#[tauri::command]
pub fn window_receive_quit(
    window: tauri::WebviewWindow,
    state: State<'_, QuitState>,
    request_id: String,
) {
    state.deliver(window.label(), &request_id, QuitMessage::Received);
}

#[tauri::command]
pub fn window_answer_quit(
    window: tauri::WebviewWindow,
    state: State<'_, QuitState>,
    request_id: String,
    accepted: bool,
) {
    state.deliver(window.label(), &request_id, QuitMessage::Answer(accepted));
}

#[tauri::command]
pub async fn new_window(app: tauri::AppHandle, state: State<'_, QuitState>) -> Result<(), String> {
    state.refuse_while_quitting()?;
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

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .unwrap()
    }

    const SHORT: Duration = Duration::from_millis(20);
    const LONG: Duration = Duration::from_secs(1);

    /// A pending request as `ask` leaves it, without a Tauri app.
    fn pending<'a>(state: &'a QuitState, window: &str, request_id: &str) -> AskedWindow<'a> {
        let (sender, messages) = unbounded_channel();
        state.pending_lock().insert(
            request_id.to_string(),
            PendingQuit {
                window: window.to_string(),
                messages: sender,
            },
        );
        AskedWindow {
            state,
            request_id: request_id.to_string(),
            messages,
        }
    }

    #[test]
    fn destroying_a_window_cancels_only_its_pending_requests() {
        let state = QuitState::default();
        let mut a = pending(&state, "win-a", "r1");
        let mut b = pending(&state, "win-b", "r2");
        state.cancel_window("win-a");
        assert!(matches!(
            a.messages.try_recv(),
            Err(tokio::sync::mpsc::error::TryRecvError::Disconnected)
        ));
        assert!(matches!(
            b.messages.try_recv(),
            Err(tokio::sync::mpsc::error::TryRecvError::Empty)
        ));
    }

    #[test]
    fn a_window_cannot_answer_another_windows_request() {
        let state = QuitState::default();
        let mut asked = pending(&state, "win-a", "r1");
        state.deliver("win-b", "r1", QuitMessage::Answer(true));
        assert!(asked.messages.try_recv().is_err());
        state.deliver("win-a", "r1", QuitMessage::Answer(true));
        assert!(asked.messages.try_recv().is_ok());
    }

    #[test]
    fn a_finished_request_is_forgotten() {
        let state = QuitState::default();
        drop(pending(&state, "win-a", "r1"));
        assert!(state.pending_lock().is_empty());
    }

    #[test]
    fn only_one_quit_can_run_at_a_time_and_a_cancelled_one_frees_the_way() {
        let state = QuitState::default();
        let first = state.begin_quit();
        assert!(first.is_some());
        assert!(state.begin_quit().is_none());
        drop(first);
        assert!(state.begin_quit().is_some());
    }

    #[test]
    fn window_creation_is_refused_during_quit_and_after_commit() {
        let state = QuitState::default();
        assert!(state.refuse_while_quitting().is_ok());
        let mut attempt = state.begin_quit().unwrap();
        assert!(state.refuse_while_quitting().is_err());
        attempt.committed = true;
        drop(attempt);
        assert!(state.refuse_while_quitting().is_err());
    }

    #[test]
    fn a_window_that_never_confirms_receipt_counts_as_yes_quickly() {
        runtime().block_on(async {
            let (_sender, mut messages) = unbounded_channel();
            assert!(await_quit_reply(&mut messages, SHORT, None).await);
        });
    }

    #[test]
    fn a_confirmed_window_is_waited_for_until_it_answers_or_closes() {
        runtime().block_on(async {
            let (sender, mut messages) = unbounded_channel();
            sender.send(QuitMessage::Received).unwrap();
            let waiting = tokio::time::timeout(SHORT, await_quit_reply(&mut messages, LONG, None));
            assert!(
                waiting.await.is_err(),
                "no deadline while the dialog is open"
            );

            sender.send(QuitMessage::Answer(false)).unwrap();
            assert!(!await_quit_reply(&mut messages, LONG, None).await);

            let (sender, mut messages) = unbounded_channel();
            sender.send(QuitMessage::Received).unwrap();
            drop(sender);
            assert!(await_quit_reply(&mut messages, LONG, None).await);
        });
    }

    #[test]
    fn a_save_is_waited_for_only_so_long() {
        runtime().block_on(async {
            let (sender, mut messages) = unbounded_channel();
            sender.send(QuitMessage::Received).unwrap();
            assert!(await_quit_reply(&mut messages, LONG, Some(SHORT)).await);
        });
    }

    #[test]
    fn an_answer_without_a_receipt_counts_as_both() {
        runtime().block_on(async {
            let (sender, mut messages) = unbounded_channel();
            sender.send(QuitMessage::Answer(false)).unwrap();
            assert!(!await_quit_reply(&mut messages, LONG, None).await);
        });
    }
}
