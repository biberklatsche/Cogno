//! Sign-ins: Cogno signs in to a host in the browser and serves git the token
//! as its credential helper (ARCHITECTURE.md 2.1, "Anmeldungen").
//!
//! This is the one place that holds, refreshes and hands out tokens. Refresh
//! tokens are single-use, and Cogno has several windows: two of them
//! refreshing at once would lose the sign-in. So everything about one origin
//! happens one after the other here, and the new pair of tokens is stored
//! before anybody gets an answer.
//!
//! No provider is known here. The feature that offers a sign-in names the
//! endpoints, the client and the scopes; they are kept with the sign-in.

pub mod commands;
pub mod git_config;
pub mod helper;
pub mod oauth;
pub mod store;

use oauth::{Grant, GrantError};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use store::{Provider, SignIn, Store, Tokens};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

/// Event to every window: the list of sign-ins changed.
pub const CHANGED_EVENT: &str = "sign-ins-changed";
/// How long the browser may take before a sign-in gives up.
const BROWSER_WAIT: Duration = Duration::from_secs(10 * 60);
/// A token this close to running out is refreshed before git gets it: a push
/// must not start with a token that expires while it runs.
const REFRESH_MARGIN_SECONDS: u64 = 120;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInStatus {
    pub origin: String,
    /// In the system keychain; `false` when it lasts only until Cogno exits.
    pub persistent: bool,
}

/// What git gets for an origin.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Credential {
    pub username: String,
    pub password: String,
}

type ChangeListener = Box<dyn Fn(&[SignInStatus]) + Send + Sync>;

pub struct SignIns {
    cogno_home: PathBuf,
    store: Arc<Store>,
    /// One step at a time per origin: refresh, replace, sign out.
    locks: Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
    /// Sign-ins waiting for the browser; sending ends the wait.
    waiting: Mutex<HashMap<String, oneshot::Sender<()>>>,
    on_change: ChangeListener,
}

pub(crate) fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

fn expires_soon(sign_in: &SignIn) -> bool {
    sign_in
        .expires_at
        .is_some_and(|at| at <= now() + REFRESH_MARGIN_SECONDS)
}

async fn blocking<T: Send + 'static>(work: impl FnOnce() -> T + Send + 'static) -> Option<T> {
    tokio::task::spawn_blocking(work).await.ok()
}

/// Opens the sign-ins of this build's Cogno home and tells every window when
/// they change.
pub fn manage(app: &tauri::AppHandle) {
    use tauri::{Emitter, Manager};

    let dev_mode = cfg!(debug_assertions);
    let cogno_home = crate::commands::environment::cogno_home(dev_mode)
        .unwrap_or_else(|_| std::env::temp_dir().join("cogno"));
    let store = Store::open(cogno_home.clone(), Box::new(store::Keychain::new(dev_mode)));
    let windows = app.clone();
    app.manage(helper::Typed::default());
    app.manage(SignIns::open(
        cogno_home,
        store,
        Box::new(move |statuses| {
            let _ = windows.emit(CHANGED_EVENT, statuses.to_vec());
        }),
    ));
}

impl SignIns {
    /// Reads who is signed in and brings git's config file in line with it.
    pub fn open(cogno_home: PathBuf, store: Store, on_change: ChangeListener) -> Self {
        let sign_ins = Self {
            cogno_home,
            store: Arc::new(store),
            locks: Mutex::new(HashMap::new()),
            waiting: Mutex::new(HashMap::new()),
            on_change,
        };
        sign_ins.write_git_config();
        sign_ins
    }

    pub(crate) fn cogno_home(&self) -> &std::path::Path {
        &self.cogno_home
    }

    pub fn statuses(&self) -> Vec<SignInStatus> {
        self.store
            .origins()
            .into_iter()
            .map(|(origin, persistent)| SignInStatus { origin, persistent })
            .collect()
    }

    fn write_git_config(&self) {
        let origins: Vec<String> = self
            .store
            .origins()
            .into_iter()
            .map(|(origin, _)| origin)
            .collect();
        if let Err(error) = git_config::write(&self.cogno_home, &origins) {
            log::error!(target: "sign_ins", "cannot write git's config file: {error}");
        }
    }

    /// The set of sign-ins changed: git and the windows learn of it.
    fn changed(&self) {
        self.write_git_config();
        (self.on_change)(&self.statuses());
    }

    fn lock_of(&self, origin: &str) -> Arc<tokio::sync::Mutex<()>> {
        self.locks
            .lock()
            .unwrap()
            .entry(origin.to_string())
            .or_default()
            .clone()
    }

    async fn keep(
        &self,
        origin: &str,
        provider: Provider,
        grant: Grant,
        previous_refresh: Option<String>,
    ) -> Option<(SignInStatus, Credential)> {
        let sign_in = SignIn {
            expires_at: grant.expires_in.map(|seconds| now() + seconds),
            provider,
        };
        let credential = Credential {
            username: sign_in.provider.username.clone(),
            password: grant.access_token.clone(),
        };
        let tokens = Tokens {
            access: grant.access_token,
            // A provider that does not rotate keeps the refresh token it gave.
            refresh: grant.refresh_token.or(previous_refresh),
        };
        let store = self.store.clone();
        let key = origin.to_string();
        let persistent = blocking(move || store.put(&key, sign_in, &tokens)).await?;
        Some((
            SignInStatus {
                origin: origin.to_string(),
                persistent,
            },
            credential,
        ))
    }

    async fn drop_sign_in(&self, origin: &str) {
        let store = self.store.clone();
        let key = origin.to_string();
        if blocking(move || store.remove(&key)).await == Some(true) {
            self.changed();
        }
    }

    /// The sign-in of `origin` with its access token, read off the runtime's
    /// threads: the keychain may take its time. The store signs an origin out
    /// whose token is gone from the keychain; git and the windows hear of it.
    async fn stored(&self, origin: &str) -> Option<(SignIn, String)> {
        let was_signed_in = self.store.contains(origin);
        let store = self.store.clone();
        let key = origin.to_string();
        let found = blocking(move || store.get(&key)).await?;
        if found.is_none() && was_signed_in && !self.store.contains(origin) {
            self.changed();
        }
        found
    }

    /// Signs in to `origin` in the browser. `open` shows the page; the wait
    /// ends with the redirect, with `cancel`, or after `BROWSER_WAIT`.
    pub async fn sign_in(
        &self,
        origin: &str,
        provider: Provider,
        open: impl FnOnce(&str) -> Result<(), String>,
    ) -> Result<SignInStatus, String> {
        let origin = git_config::normalize_origin(origin)
            .ok_or_else(|| format!("{origin} is not an origin git has credentials for"))?;
        let pkce = oauth::pkce()?;
        let state = uuid::Uuid::new_v4().simple().to_string();
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .await
            .map_err(|error| error.to_string())?;
        let port = listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port();
        // The path is part of what the provider compares; the port is not.
        let redirect_uri = format!("http://127.0.0.1:{port}/");
        let url = oauth::authorize_url(&provider, &redirect_uri, &state, &pkce.challenge)?;

        let (cancel, cancelled) = oneshot::channel();
        // A second sign-in for the origin takes over: the first one's sender is
        // dropped here and its wait ends.
        self.waiting.lock().unwrap().insert(origin.clone(), cancel);
        open(&url)?;
        let (code, still_ours) = tokio::select! {
            code = oauth::wait_for_code(listener, &state) => (code, true),
            // Cancelled, or replaced by a second sign-in whose entry must stay.
            _ = cancelled => (Err("The sign-in was cancelled.".to_string()), false),
            _ = tokio::time::sleep(BROWSER_WAIT) => (Err("The sign-in was not finished in the browser.".to_string()), true),
        };
        if still_ours {
            self.waiting.lock().unwrap().remove(&origin);
        }
        let code = code?;

        let grant = oauth::exchange(&provider, &code, &redirect_uri, &pkce.verifier)
            .await
            .map_err(|error| error.to_string())?;
        let lock = self.lock_of(&origin);
        let _one_at_a_time = lock.lock().await;
        let (status, _) = self
            .keep(&origin, provider, grant, None)
            .await
            .ok_or("The sign-in could not be stored.")?;
        self.changed();
        Ok(status)
    }

    /// Ends the wait of a sign-in still in the browser.
    pub fn cancel(&self, origin: &str) {
        if let Some(origin) = git_config::normalize_origin(origin) {
            if let Some(cancel) = self.waiting.lock().unwrap().remove(&origin) {
                let _ = cancel.send(());
            }
        }
    }

    pub async fn sign_out(&self, origin: &str) {
        let Some(origin) = git_config::normalize_origin(origin) else {
            return;
        };
        let lock = self.lock_of(&origin);
        let _one_at_a_time = lock.lock().await;
        self.drop_sign_in(&origin).await;
    }

    /// What git gets for `origin`: the token, refreshed first when it is about
    /// to run out. `None` when nobody is signed in there, or not any more.
    pub async fn credential(&self, origin: &str) -> Option<Credential> {
        // Git asks for every host no other helper knows: most are not ours,
        // and those need neither the lock nor the keychain.
        if !self.store.contains(origin) {
            return None;
        }
        let lock = self.lock_of(origin);
        let _one_at_a_time = lock.lock().await;
        let (sign_in, access) = self.stored(origin).await?;
        if !expires_soon(&sign_in) {
            return Some(Credential {
                username: sign_in.provider.username,
                password: access,
            });
        }
        self.renew(origin, sign_in).await
    }

    /// Git reports the credential it used for `origin` as rejected. If that is
    /// the token handed out here, it is renewed once; an origin that cannot be
    /// renewed is signed out.
    pub async fn rejected(&self, origin: &str, password: &str) {
        if !self.store.contains(origin) {
            return;
        }
        let lock = self.lock_of(origin);
        let _one_at_a_time = lock.lock().await;
        let Some((sign_in, access)) = self.stored(origin).await else {
            return;
        };
        // A token replaced in the meantime: the rejection is about the old one.
        if access != password {
            return;
        }
        self.renew(origin, sign_in).await;
    }

    async fn renew(&self, origin: &str, sign_in: SignIn) -> Option<Credential> {
        let store = self.store.clone();
        let key = origin.to_string();
        let refresh = match blocking(move || store.refresh_token(&key)).await? {
            Ok(Some(refresh)) => refresh,
            Ok(None) => {
                log::info!(target: "sign_ins", "{origin}: the token is spent and cannot be renewed; signed out");
                self.drop_sign_in(origin).await;
                return None;
            }
            // A keychain that does not answer says nothing about the sign-in.
            Err(error) => {
                log::warn!(target: "sign_ins", "{origin}: keychain read for the renewal failed: {error}");
                return None;
            }
        };
        match oauth::refresh(&sign_in.provider, &refresh).await {
            Ok(grant) => {
                let (_, credential) = self
                    .keep(origin, sign_in.provider, grant, Some(refresh))
                    .await?;
                Some(credential)
            }
            Err(GrantError::Rejected(reason)) => {
                log::info!(target: "sign_ins", "{origin}: the refresh was rejected ({reason}); signed out");
                self.drop_sign_in(origin).await;
                None
            }
            // Offline says nothing about the sign-in; it stays.
            Err(GrantError::Unreachable(reason)) => {
                log::warn!(target: "sign_ins", "{origin}: the token could not be renewed: {reason}");
                None
            }
        }
    }
}

#[cfg(test)]
mod tests;
