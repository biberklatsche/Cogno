//! Self-update. An update is process-wide - one installation, one download -
//! so Rust owns its state and every window receives each change as a broadcast
//! (ARCHITECTURE.md 2.6). Windows ask for checks on their own schedule; checks
//! that follow each other closely are answered from the last result. A new
//! version is announced once per app, to the focused window.

use crate::commands::window_registry::route;
use crate::db::Db;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Notify;

const STATE_EVENT: &str = "updater-state";
const ANNOUNCEMENT_EVENT: &str = "updater-announcement";
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

#[derive(Clone, Serialize, PartialEq)]
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
    announced_version: Option<String>,
}

pub struct Updater {
    inner: Mutex<Inner>,
    /// Woken after every state change, so a command can wait for one.
    changed: Notify,
}

impl Updater {
    pub fn new(current_version: String) -> Self {
        Self {
            inner: Mutex::new(Inner {
                state: UpdaterState {
                    phase: UpdaterPhase::Idle,
                    current_version,
                    version: None,
                    notes: None,
                    installable: installable(),
                    error: None,
                },
                update: None,
                bytes: None,
                last_check: None,
                announced_version: None,
            }),
            changed: Notify::new(),
        }
    }

    fn snapshot(&self) -> UpdaterState {
        self.inner.lock().unwrap().state.clone()
    }

    /// Applies `change` and, when the state differs afterwards, broadcasts it
    /// with the lock released. The lock is held for nothing else.
    fn set<T>(&self, app: &AppHandle, change: impl FnOnce(&mut Inner) -> T) -> T {
        let (result, changed) = {
            let mut inner = self.inner.lock().unwrap();
            let before = inner.state.clone();
            let result = change(&mut inner);
            let changed = (inner.state != before).then(|| inner.state.clone());
            (result, changed)
        };
        if let Some(state) = changed {
            let _ = app.emit(STATE_EVENT, state);
            self.changed.notify_waiters();
        }
        result
    }

    fn fail(&self, app: &AppHandle, error: impl ToString) {
        self.set(app, |inner| {
            inner.state.phase = UpdaterPhase::Failed;
            inner.state.error = Some(error.to_string());
        });
    }

    /// Waits while a download runs; the state that follows it is settled.
    async fn wait_for_download(&self) {
        loop {
            let changed = self.changed.notified();
            if self.snapshot().phase != UpdaterPhase::Downloading {
                return;
            }
            changed.await;
        }
    }

    /// Tells the user about the version on offer once per app, as soon as
    /// nothing more happens on its own: it is ready to install, or it waits for
    /// the user. The announcement goes to the focused window only, like every
    /// global action without a target (ARCHITECTURE.md 2.6).
    fn announce(&self, app: &AppHandle) {
        let state = {
            let mut inner = self.inner.lock().unwrap();
            let settled = matches!(
                inner.state.phase,
                UpdaterPhase::Ready | UpdaterPhase::Available
            );
            let Some(version) = inner.state.version.clone().filter(|_| settled) else {
                return;
            };
            if inner.announced_version.as_ref() == Some(&version) {
                return;
            }
            inner.announced_version = Some(version);
            inner.state.clone()
        };
        route(app, ANNOUNCEMENT_EVENT, state, None);
    }
}

/// Whether this installation can replace itself: a release build the bundler
/// produced. On macOS `bundle_type` is `App` for any binary, so the
/// executable's place inside a `.app` bundle tells a bundled build apart.
fn installable() -> bool {
    if cfg!(debug_assertions) {
        return false;
    }
    if cfg!(target_os = "macos") {
        return std::env::current_exe().is_ok_and(|exe| {
            exe.components()
                .any(|part| part.as_os_str().to_string_lossy().ends_with(".app"))
        });
    }
    tauri::utils::platform::bundle_type().is_some()
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
    let skip = updater.set(&app, |inner| {
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
            None
        }
    });
    match skip {
        Some(true) => fetch_update(&app, &updater).await,
        Some(false) => {}
        None => run_check(&app, &updater, download).await,
    }
    updater.announce(&app);
    Ok(())
}

async fn run_check(app: &AppHandle, updater: &Updater, download: bool) {
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
            let already_ready = updater.set(app, |inner| {
                let already_ready = inner.bytes.is_some()
                    && inner.state.version.as_deref() == Some(version.as_str());
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
                already_ready
            });
            if download && !already_ready && updater.snapshot().installable {
                fetch_update(app, updater).await;
            }
        }
        Ok(None) => updater.set(app, |inner| {
            inner.state.phase = UpdaterPhase::UpToDate;
            inner.state.version = None;
            inner.state.notes = None;
            inner.update = None;
            inner.bytes = None;
        }),
        // A version already on offer stays on offer; only the check failed.
        Err(error) => updater.set(app, |inner| {
            if inner.update.is_none() {
                inner.state.phase = UpdaterPhase::Failed;
                inner.state.error = Some(error.to_string());
                return;
            }
            log::warn!("[updater] Check failed, keeping the known update: {error}");
            inner.state.phase = if inner.bytes.is_some() {
                UpdaterPhase::Ready
            } else {
                UpdaterPhase::Available
            };
        }),
    }
}

/// Installs the update, downloading it first when needed, and restarts the app.
/// On Windows the installer ends the process itself. A download already
/// running - from a check - is waited for, not doubled.
#[tauri::command]
pub async fn updater_install(app: AppHandle, updater: State<'_, Updater>) -> Result<(), String> {
    if !updater.snapshot().installable {
        return Err("This installation cannot update itself.".into());
    }
    updater.wait_for_download().await;
    if updater.inner.lock().unwrap().bytes.is_none() {
        fetch_update(&app, &updater).await;
    }
    // The bytes move out: an installer is used once, and a failed install
    // downloads again next time instead of retrying stale bytes.
    let downloaded = {
        let mut inner = updater.inner.lock().unwrap();
        match (inner.update.clone(), inner.bytes.take()) {
            (Some(update), Some(bytes)) => Some((update, bytes)),
            _ => None,
        }
    };
    let Some((update, bytes)) = downloaded else {
        let error = "No downloaded update to install.";
        if updater.snapshot().phase != UpdaterPhase::Failed {
            updater.fail(&app, error);
        }
        return Err(error.into());
    };
    let installed = tauri::async_runtime::spawn_blocking(move || update.install(bytes)).await;
    let error = match installed {
        Ok(Ok(())) => None,
        Ok(Err(error)) => Some(error.to_string()),
        Err(error) => Some(error.to_string()),
    };
    if let Some(error) = error {
        updater.fail(&app, &error);
        return Err(error);
    }
    app.request_restart();
    Ok(())
}

async fn fetch_update(app: &AppHandle, updater: &Updater) {
    let update = updater.set(app, |inner| {
        if inner.state.phase == UpdaterPhase::Downloading {
            return None;
        }
        let update = inner.update.clone()?;
        inner.state.phase = UpdaterPhase::Downloading;
        Some(update)
    });
    let Some(update) = update else {
        return;
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
