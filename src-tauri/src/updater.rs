//! Self-update. An update is process-wide - one installation, one download -
//! so Rust owns its state and every window receives each change as a broadcast
//! (ARCHITECTURE.md 2.6). Windows ask for checks on their own schedule; checks
//! that follow each other closely are answered from the last result.

use crate::db::Db;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const STATE_EVENT: &str = "updater-state";
const MIN_CHECK_INTERVAL: Duration = Duration::from_secs(10 * 60);

#[derive(Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum UpdaterPhase {
    Idle,
    Checking,
    UpToDate,
    Available,
    Downloading,
    Ready,
    Failed,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterState {
    phase: UpdaterPhase,
    current_version: String,
    version: Option<String>,
    notes: Option<String>,
    /// False when this installation cannot replace itself: a debug build, or a
    /// Linux package the bundler did not produce. The app then only points to
    /// the download page.
    installable: bool,
    error: Option<String>,
}

struct Inner {
    state: UpdaterState,
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
    last_check: Option<Instant>,
}

pub struct Updater(Mutex<Inner>);

impl Updater {
    pub fn new(current_version: String) -> Self {
        let installable =
            tauri::utils::platform::bundle_type().is_some() && !cfg!(debug_assertions);
        Self(Mutex::new(Inner {
            state: UpdaterState {
                phase: UpdaterPhase::Idle,
                current_version,
                version: None,
                notes: None,
                installable,
                error: None,
            },
            update: None,
            bytes: None,
            last_check: None,
        }))
    }

    fn snapshot(&self) -> UpdaterState {
        self.0.lock().unwrap().state.clone()
    }

    /// Applies `change` to the state and broadcasts the result.
    fn set(&self, app: &AppHandle, change: impl FnOnce(&mut Inner)) {
        let state = {
            let mut inner = self.0.lock().unwrap();
            change(&mut inner);
            inner.state.clone()
        };
        let _ = app.emit(STATE_EVENT, state);
    }

    fn fail(&self, app: &AppHandle, error: impl ToString) {
        self.set(app, |inner| {
            inner.state.phase = UpdaterPhase::Failed;
            inner.state.error = Some(error.to_string());
        });
    }
}

#[tauri::command]
pub fn updater_state(updater: State<'_, Updater>) -> UpdaterState {
    updater.snapshot()
}

/// Checks for an update and, with `download`, fetches an installable one right
/// away. Without `force`, a check within `MIN_CHECK_INTERVAL` of the last one
/// is skipped; a check or download already running is never doubled.
#[tauri::command]
pub async fn updater_check(
    app: AppHandle,
    updater: State<'_, Updater>,
    force: bool,
    download: bool,
) -> Result<(), String> {
    // `Some(fetch)`: skip the check, and fetch the known update when asked to.
    let skip = {
        let mut inner = updater.0.lock().unwrap();
        let busy = matches!(
            inner.state.phase,
            UpdaterPhase::Checking | UpdaterPhase::Downloading
        );
        let recent = inner
            .last_check
            .is_some_and(|last| last.elapsed() < MIN_CHECK_INTERVAL);
        if busy || (recent && !force) {
            Some(
                download
                    && !busy
                    && inner.state.phase == UpdaterPhase::Available
                    && inner.state.installable,
            )
        } else {
            inner.state.phase = UpdaterPhase::Checking;
            inner.state.error = None;
            inner.last_check = Some(Instant::now());
            let _ = app.emit(STATE_EVENT, inner.state.clone());
            None
        }
    };
    if let Some(fetch) = skip {
        if fetch {
            fetch_update(&app, &updater).await;
        }
        return Ok(());
    }

    // On Windows the installer ends the process with `exit(0)`, which skips
    // `RunEvent::Exit`, so the database is closed beforehand.
    let handle = app.clone();
    let checked = match app
        .updater_builder()
        .on_before_exit(move || handle.state::<Db>().close())
        .build()
    {
        Ok(plugin_updater) => plugin_updater.check().await,
        Err(error) => Err(error),
    };
    match checked {
        Ok(Some(update)) => {
            let version = update.version.clone();
            let already_ready = {
                let inner = updater.0.lock().unwrap();
                inner.bytes.is_some() && inner.state.version.as_deref() == Some(version.as_str())
            };
            updater.set(&app, |inner| {
                inner.state.phase = if already_ready {
                    UpdaterPhase::Ready
                } else {
                    UpdaterPhase::Available
                };
                inner.state.version = Some(version);
                inner.state.notes = update.body.clone();
                if !already_ready {
                    inner.bytes = None;
                }
                inner.update = Some(update);
            });
            if download && !already_ready && updater.snapshot().installable {
                fetch_update(&app, &updater).await;
            }
        }
        Ok(None) => updater.set(&app, |inner| {
            inner.state.phase = UpdaterPhase::UpToDate;
            inner.state.version = None;
            inner.state.notes = None;
            inner.update = None;
            inner.bytes = None;
        }),
        Err(error) => updater.fail(&app, error),
    }
    Ok(())
}

/// Installs the update, downloading it first when needed, and restarts the app.
/// On Windows the installer ends the process itself.
#[tauri::command]
pub async fn updater_install(app: AppHandle, updater: State<'_, Updater>) -> Result<(), String> {
    let installable = updater.snapshot().installable;
    if !installable {
        return Err("This installation cannot update itself.".into());
    }
    if updater.0.lock().unwrap().bytes.is_none() {
        fetch_update(&app, &updater).await;
    }
    let (update, bytes) = {
        let inner = updater.0.lock().unwrap();
        match (inner.update.clone(), inner.bytes.clone()) {
            (Some(update), Some(bytes)) => (update, bytes),
            _ => return Err("No downloaded update to install.".into()),
        }
    };
    if let Err(error) = update.install(&bytes) {
        updater.fail(&app, &error);
        return Err(error.to_string());
    }
    app.request_restart();
    Ok(())
}

async fn fetch_update(app: &AppHandle, updater: &Updater) {
    let update = {
        let mut inner = updater.0.lock().unwrap();
        if inner.state.phase == UpdaterPhase::Downloading {
            return;
        }
        let Some(update) = inner.update.clone() else {
            return;
        };
        inner.state.phase = UpdaterPhase::Downloading;
        let _ = app.emit(STATE_EVENT, inner.state.clone());
        update
    };
    match update.download(|_, _| {}, || {}).await {
        Ok(bytes) => updater.set(app, |inner| {
            inner.state.phase = UpdaterPhase::Ready;
            inner.bytes = Some(bytes);
        }),
        Err(error) => updater.fail(app, error),
    }
}

/// Registers the state; call from `setup`, where the app handle exists.
pub fn manage(app: &AppHandle) {
    app.manage(Updater::new(app.package_info().version.to_string()));
}
