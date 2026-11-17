//! Pairing with another machine, as the webview drives it (ARCHITECTURE.md
//! 2.7.3): the Remote feature switches it on and off, the panel shows codes,
//! pairs by code, renames and removes; a request of another machine reaches
//! the last focused window, whose user allows or declines it.

use std::sync::Arc;

use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, State};

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::commands::window_registry::route;
use crate::host_endpoint::DEVELOPMENT_BUILD;
use crate::pairing::{
    PairRequest, PairedMachine, Pairing, PairingError, PairingEvents, PairingView, Server,
    ShownCode,
};

/// A machine asks to pair; to the last focused window.
const PAIRING_REQUEST_EVENT: &str = "pairing-request";
/// A request is over; to every window, wherever its dialog is.
const PAIRING_REQUEST_ENDED_EVENT: &str = "pairing-request-ended";
/// What `pairing_state` returns changed; to every window.
const PAIRING_CHANGED_EVENT: &str = "pairing-changed";

/// Pairing, when Cogno's server runs and the home can be found.
pub struct PairingState(Option<Pairing>);

impl PairingState {
    pub fn new(app: &AppHandle) -> Self {
        let home = cogno_host::identity::cogno_home(DEVELOPMENT_BUILD).ok();
        let pairing = home.zip(Server::cogno()).map(|(home, server)| {
            let events = Arc::new(WebviewPairingEvents { app: app.clone() });
            Pairing::new(&home, server, events)
        });
        Self(pairing)
    }

    fn pairing(&self) -> CommandResult<&Pairing> {
        self.0.as_ref().ok_or_else(|| {
            CommandError::new(
                AppErrorCode::PairingUnreachable,
                "Cogno's pairing server is not set up yet",
            )
        })
    }

    /// Stops pairing as the app ends: nothing stays reachable.
    pub fn close(&self) {
        if let Some(pairing) = &self.0 {
            tauri::async_runtime::block_on(pairing.disable());
        }
    }
}

struct WebviewPairingEvents {
    app: AppHandle,
}

impl PairingEvents for WebviewPairingEvents {
    fn request(&self, request: PairRequest) {
        route(&self.app, PAIRING_REQUEST_EVENT, request, None);
    }

    fn request_ended(&self, id: u64) {
        let _ = self.app.emit(PAIRING_REQUEST_ENDED_EVENT, id);
    }

    fn changed(&self) {
        let _ = self.app.emit(PAIRING_CHANGED_EVENT, ());
    }
}

fn command_error(error: PairingError) -> CommandError {
    match error {
        PairingError::Off => CommandError::new(
            AppErrorCode::PairingOff,
            "Pairing is off: switch on the Remote feature",
        ),
        PairingError::Unreachable(reason) => CommandError::new(
            AppErrorCode::PairingUnreachable,
            format!("Could not reach the other machine or Cogno's server: {reason}"),
        ),
        PairingError::UnknownCode => CommandError::new(
            AppErrorCode::PairingCodeUnknown,
            "No machine shows this code. Check it, or create a new one there",
        ),
        PairingError::Declined => CommandError::new(
            AppErrorCode::PairingDeclined,
            "The other machine did not allow the pairing",
        ),
        PairingError::Storage(error) => CommandError::internal(error),
    }
}

#[tauri::command]
pub fn pairing_state(state: State<'_, PairingState>) -> CommandResult<PairingView> {
    state.pairing()?.view().map_err(command_error)
}

/// The Remote feature was switched on: this machine becomes reachable for
/// the machines it is paired with.
#[tauri::command]
pub async fn pairing_enable(state: State<'_, PairingState>) -> CommandResult<()> {
    state.pairing()?.enable().await.map_err(command_error)
}

/// The Remote feature was switched off: nothing is reachable any more.
#[tauri::command]
pub async fn pairing_disable(state: State<'_, PairingState>) -> CommandResult<()> {
    if let Some(pairing) = &state.0 {
        pairing.disable().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn pairing_create_code(state: State<'_, PairingState>) -> CommandResult<ShownCode> {
    state.pairing()?.create_code().await.map_err(command_error)
}

#[tauri::command]
pub fn pairing_cancel_code(state: State<'_, PairingState>) -> CommandResult<()> {
    state.pairing()?.cancel_code();
    Ok(())
}

/// Pairs with the machine that shows `code`; `on_check` gets the check
/// number to compare while that machine asks its user. `taken` are the
/// names of the other remotes, which the new machine must not get.
#[tauri::command]
pub async fn pairing_add(
    state: State<'_, PairingState>,
    code: String,
    taken: Vec<String>,
    on_check: Channel<String>,
) -> CommandResult<PairedMachine> {
    state
        .pairing()?
        .pair_by_code(&code, &taken, |check| {
            let _ = on_check.send(check);
        })
        .await
        .map_err(command_error)
}

/// The user's answer to a request: the name to pair the machine under, or
/// none to decline.
#[tauri::command]
pub fn pairing_answer(
    state: State<'_, PairingState>,
    id: u64,
    name: Option<String>,
) -> CommandResult<()> {
    state.pairing()?.answer(id, name);
    Ok(())
}

#[tauri::command]
pub fn pairing_set_accepting(state: State<'_, PairingState>, on: bool) -> CommandResult<()> {
    state.pairing()?.set_accepting(on).map_err(command_error)
}

#[tauri::command]
pub fn pairing_rename(
    state: State<'_, PairingState>,
    previous: String,
    name: String,
) -> CommandResult<()> {
    state
        .pairing()?
        .rename(&previous, &name)
        .map_err(command_error)
}

/// Removes the pairing here and on the other machine; whether that one
/// heard of it.
#[tauri::command]
pub async fn pairing_remove(state: State<'_, PairingState>, name: String) -> CommandResult<bool> {
    state.pairing()?.remove(&name).await.map_err(command_error)
}
