//! Pairing with another machine, as the webview drives it (ARCHITECTURE.md
//! 2.7.3): the Remote feature switches it on and off; the panel opens and
//! closes pairing, lists the machines nearby, asks one to pair, renames and
//! removes. A request of another machine reaches the last focused window;
//! on both machines the user says whether the check number is the same.

use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
use crate::commands::window_registry::route;
use crate::host_endpoint::DEVELOPMENT_BUILD;
use crate::pairing::{PairRequest, PairedMachine, Pairing, PairingEvents, PairingView};

/// A machine asks to pair; to the last focused window.
const PAIRING_REQUEST_EVENT: &str = "pairing-request";
/// A request is over; to every window, wherever its dialog is.
const PAIRING_REQUEST_ENDED_EVENT: &str = "pairing-request-ended";
/// What `pairing_state` returns changed; to every window.
const PAIRING_CHANGED_EVENT: &str = "pairing-changed";

/// Pairing, when this machine's host is open, and the windows that have it
/// open. The pair form of every window opens pairing while it is shown;
/// pairing itself is open for as long as any of them does.
pub struct PairingState(Option<Pairing>, Mutex<Openers>);

/// The windows that have pairing open, by label.
#[derive(Default)]
struct Openers(HashSet<String>);

impl Openers {
    /// Notes what the window did; returns whether any window has it open now.
    fn set(&mut self, label: &str, open: bool) -> bool {
        if open {
            self.0.insert(label.to_string());
        } else {
            self.0.remove(label);
        }
        !self.0.is_empty()
    }
}

impl PairingState {
    /// Call after the app manages its `HostState`.
    pub fn new(app: &AppHandle) -> Self {
        let home = cogno_host::identity::cogno_home(DEVELOPMENT_BUILD).ok();
        let host = app.state::<crate::hosts::HostState>().local_host();
        let pairing = home.zip(host).map(|(home, host)| {
            let events = Arc::new(WebviewPairingEvents { app: app.clone() });
            Pairing::new(&home, host, events)
        });
        Self(pairing, Mutex::new(Openers::default()))
    }

    /// The window with `label` opened or closed pairing.
    fn set_open(&self, label: &str, open: bool) -> CommandResult<()> {
        let pairing = self.pairing()?;
        let mut openers = self
            .1
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let result = pairing.set_open(openers.set(label, open));
        if result.is_err() && open {
            // Not open after all: the window must not hold it open later.
            openers.set(label, false);
        }
        result.map_err(CommandError::from)
    }

    /// A window is gone, and with it the pair form it may have shown.
    pub fn window_closed(&self, label: &str) {
        // Pairing that is off has nothing open to close.
        let _ = self.set_open(label, false);
    }

    pub(crate) fn pairing(&self) -> CommandResult<&Pairing> {
        self.0.as_ref().ok_or_else(|| {
            CommandError::new(
                AppErrorCode::PairingOff,
                "Pairing does not work: this machine's Cogno host could not be opened",
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

#[tauri::command]
pub fn pairing_state(state: State<'_, PairingState>) -> CommandResult<PairingView> {
    state.pairing()?.view().map_err(CommandError::from)
}

/// The Remote feature was switched on: this machine becomes reachable for
/// the machines it is paired with - with `relay`, the address of a relay
/// server, also for those in other networks.
#[tauri::command]
pub async fn pairing_enable(
    state: State<'_, PairingState>,
    relay: Option<String>,
) -> CommandResult<()> {
    state
        .pairing()?
        .enable(relay.as_deref())
        .await
        .map_err(CommandError::from)
}

/// The Remote feature was switched off: nothing is reachable any more.
#[tauri::command]
pub async fn pairing_disable(state: State<'_, PairingState>) -> CommandResult<()> {
    if let Some(pairing) = &state.0 {
        pairing.disable().await;
    }
    Ok(())
}

/// The user opened or closed pairing in the calling window. While any window
/// has it open, this machine is seen by the machines nearby and takes their
/// requests to pair.
#[tauri::command]
pub fn pairing_set_open(
    window: tauri::Window,
    state: State<'_, PairingState>,
    open: bool,
) -> CommandResult<()> {
    state.set_open(window.label(), open)
}

/// Asks the machine with `id` to pair: one nearby, or one whose invitation
/// the user pasted. `on_request` gets the check
/// number to show; `pairing_answer` says whether the user found it the same
/// on the other machine. Resolves once both users confirmed.
#[tauri::command]
pub async fn pairing_pair(
    state: State<'_, PairingState>,
    id: String,
    on_request: Channel<PairRequest>,
) -> CommandResult<PairedMachine> {
    state
        .pairing()?
        .pair(&id, |request| {
            let _ = on_request.send(request);
        })
        .await
        .map_err(CommandError::from)
}

/// What the user says to a request: whether the check number is the same on
/// both machines.
#[tauri::command]
pub fn pairing_answer(
    state: State<'_, PairingState>,
    id: u64,
    confirmed: bool,
) -> CommandResult<()> {
    state.pairing()?.answer(id, confirmed);
    Ok(())
}

/// Calls the paired machine `id` `name` from now on.
#[tauri::command]
pub fn pairing_rename(
    state: State<'_, PairingState>,
    id: String,
    name: String,
) -> CommandResult<()> {
    state
        .pairing()?
        .rename(&id, &name)
        .map_err(CommandError::from)
}

/// Removes the pairing here and on the other machine; whether that one
/// heard of it.
#[tauri::command]
pub async fn pairing_remove(state: State<'_, PairingState>, id: String) -> CommandResult<bool> {
    state
        .pairing()?
        .remove(&id)
        .await
        .map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use super::Openers;

    #[test]
    fn pairing_stays_open_until_the_last_window_closes_it() {
        let mut openers = Openers::default();

        assert!(openers.set("main", true));
        assert!(openers.set("second", true));
        assert!(openers.set("main", false));
        assert!(!openers.set("second", false));
    }

    #[test]
    fn a_window_that_never_opened_it_closes_nothing() {
        let mut openers = Openers::default();
        openers.set("main", true);

        assert!(openers.set("second", false));
    }
}
