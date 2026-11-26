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
/// How long a credential typed by hand is handed out again: one push must not
/// ask for every fetch that follows. Kept in memory only.
const TYPED_SECONDS: u64 = 60 * 60;
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
    /// Credentials typed by hand, with the second they are forgotten at.
    typed: Mutex<HashMap<String, (Credential, u64)>>,
    on_change: ChangeListener,
}

fn now() -> u64 {
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
            typed: Mutex::new(HashMap::new()),
            on_change,
        };
        sign_ins.write_git_config();
        sign_ins
    }

    pub fn cogno_home(&self) -> &std::path::Path {
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

    async fn drop_sign_in(&self, origin: &str) -> bool {
        let store = self.store.clone();
        let key = origin.to_string();
        let removed = blocking(move || store.remove(&key)).await.unwrap_or(false);
        if removed {
            self.changed();
        }
        removed
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

    pub async fn sign_out(&self, origin: &str) -> bool {
        let Some(origin) = git_config::normalize_origin(origin) else {
            return false;
        };
        let lock = self.lock_of(&origin);
        let _one_at_a_time = lock.lock().await;
        self.drop_sign_in(&origin).await
    }

    /// A credential the person typed for `origin` is handed out again for a
    /// while. Whether it is stored for longer is up to the user's own helpers,
    /// which git calls after a successful access.
    pub fn remember_typed(&self, origin: &str, credential: Credential) {
        self.typed
            .lock()
            .unwrap()
            .insert(origin.to_string(), (credential, now() + TYPED_SECONDS));
    }

    fn typed_for(&self, origin: &str) -> Option<Credential> {
        let mut typed = self.typed.lock().unwrap();
        match typed.get(origin) {
            Some((credential, until)) if *until > now() => Some(credential.clone()),
            Some(_) => {
                typed.remove(origin);
                None
            }
            None => None,
        }
    }

    /// What git gets for `origin`: the token, refreshed first when it is about
    /// to run out, or what the person typed a moment ago. `None` when nobody
    /// is signed in there, or not any more.
    pub async fn credential(&self, origin: &str) -> Option<Credential> {
        let lock = self.lock_of(origin);
        let _one_at_a_time = lock.lock().await;
        let store = self.store.clone();
        let key = origin.to_string();
        let Some((sign_in, tokens)) = blocking(move || store.get(&key)).await? else {
            return self.typed_for(origin);
        };
        if !expires_soon(&sign_in) {
            return Some(Credential {
                username: sign_in.provider.username,
                password: tokens.access,
            });
        }
        self.renew(origin, sign_in, tokens).await
    }

    /// Git reports the credential it used for `origin` as rejected. If that is
    /// the token handed out here, it is renewed once; an origin that cannot be
    /// renewed is signed out.
    pub async fn rejected(&self, origin: &str, password: &str) {
        let lock = self.lock_of(origin);
        let _one_at_a_time = lock.lock().await;
        self.typed
            .lock()
            .unwrap()
            .retain(|typed_origin, (credential, _)| {
                typed_origin != origin || credential.password != password
            });
        let store = self.store.clone();
        let key = origin.to_string();
        let Some(Some((sign_in, tokens))) = blocking(move || store.get(&key)).await else {
            return;
        };
        // A token replaced in the meantime: the rejection is about the old one.
        if tokens.access != password {
            return;
        }
        self.renew(origin, sign_in, tokens).await;
    }

    async fn renew(&self, origin: &str, sign_in: SignIn, tokens: Tokens) -> Option<Credential> {
        let Some(refresh) = tokens.refresh else {
            log::info!(target: "sign_ins", "{origin}: the token is spent and cannot be renewed; signed out");
            self.drop_sign_in(origin).await;
            return None;
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
mod tests {
    use super::store::tests::{provider, temp_home, FakeKeychain};
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    const ORIGIN: &str = "https://gitlab.com";

    /// A token endpoint that answers each request with the next body.
    async fn token_endpoint(
        answers: Vec<(u16, &'static str)>,
    ) -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let url = format!(
            "http://127.0.0.1:{}/token",
            listener.local_addr().unwrap().port()
        );
        let requests = Arc::new(Mutex::new(Vec::new()));
        let seen = requests.clone();
        tokio::spawn(async move {
            for (status, body) in answers {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut request = Vec::new();
                let mut chunk = [0u8; 4096];
                loop {
                    let read = stream.read(&mut chunk).await.unwrap();
                    request.extend_from_slice(&chunk[..read]);
                    let text = String::from_utf8_lossy(&request).to_string();
                    let Some((head, sent)) = text.split_once("\r\n\r\n") else {
                        continue;
                    };
                    let length = head
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .map(|value| value.trim().parse::<usize>().unwrap())
                        })
                        .unwrap_or(0);
                    if sent.len() >= length {
                        seen.lock().unwrap().push(sent.to_string());
                        break;
                    }
                }
                let reply = format!(
                    "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(reply.as_bytes()).await.unwrap();
            }
        });
        (url, requests)
    }

    struct Fixture {
        sign_ins: SignIns,
        home: PathBuf,
        changes: Arc<Mutex<Vec<Vec<SignInStatus>>>>,
    }

    fn fixture() -> Fixture {
        let home = temp_home();
        let changes = Arc::new(Mutex::new(Vec::new()));
        let seen = changes.clone();
        let sign_ins = SignIns::open(
            home.clone(),
            Store::open(home.clone(), Box::new(FakeKeychain::default())),
            Box::new(move |statuses| seen.lock().unwrap().push(statuses.to_vec())),
        );
        Fixture {
            sign_ins,
            home,
            changes,
        }
    }

    async fn signed_in(
        fixture: &Fixture,
        token_url: &str,
        expires_in: Option<u64>,
        refresh: Option<&str>,
    ) {
        let provider = Provider {
            token_url: token_url.to_string(),
            ..provider()
        };
        let grant = Grant {
            access_token: "first".into(),
            refresh_token: refresh.map(str::to_string),
            expires_in,
        };
        fixture
            .sign_ins
            .keep(ORIGIN, provider, grant, None)
            .await
            .unwrap();
        fixture.sign_ins.changed();
    }

    fn git_config(fixture: &Fixture) -> String {
        std::fs::read_to_string(git_config::path(&fixture.home)).unwrap()
    }

    #[tokio::test]
    async fn a_fresh_token_is_handed_out_as_it_is() {
        let fixture = fixture();
        signed_in(
            &fixture,
            "http://127.0.0.1:1/unused",
            Some(7200),
            Some("r1"),
        )
        .await;

        assert_eq!(
            fixture.sign_ins.credential(ORIGIN).await,
            Some(Credential {
                username: "oauth2".into(),
                password: "first".into()
            })
        );
        assert!(git_config(&fixture).contains("[credential \"https://gitlab.com\"]"));
    }

    #[tokio::test]
    async fn a_token_about_to_run_out_is_renewed_and_the_new_pair_kept() {
        let (token_url, requests) = token_endpoint(vec![(
            200,
            r#"{"access_token":"second","refresh_token":"r2","expires_in":7200}"#,
        )])
        .await;
        let fixture = fixture();
        signed_in(&fixture, &token_url, Some(30), Some("r1")).await;

        let credential = fixture.sign_ins.credential(ORIGIN).await;

        assert_eq!(credential.unwrap().password, "second");
        assert!(requests.lock().unwrap()[0].contains("grant_type=refresh_token&refresh_token=r1"));
        // The second request uses what the first one stored: no further refresh.
        assert_eq!(
            fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
            "second"
        );
        assert_eq!(requests.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn two_requests_at_once_spend_the_refresh_token_once() {
        let (token_url, requests) = token_endpoint(vec![(
            200,
            r#"{"access_token":"second","refresh_token":"r2","expires_in":7200}"#,
        )])
        .await;
        let fixture = fixture();
        signed_in(&fixture, &token_url, Some(30), Some("r1")).await;

        let (first, second) = tokio::join!(
            fixture.sign_ins.credential(ORIGIN),
            fixture.sign_ins.credential(ORIGIN)
        );

        assert_eq!(first.unwrap().password, "second");
        assert_eq!(second.unwrap().password, "second");
        assert_eq!(requests.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn a_rejected_refresh_signs_the_origin_out() {
        let (token_url, _) = token_endpoint(vec![(400, r#"{"error":"invalid_grant"}"#)]).await;
        let fixture = fixture();
        signed_in(&fixture, &token_url, Some(30), Some("r1")).await;

        assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);

        assert!(fixture.sign_ins.statuses().is_empty());
        assert!(!git_config(&fixture).contains("gitlab.com"));
        assert_eq!(fixture.changes.lock().unwrap().last(), Some(&vec![]));
    }

    #[tokio::test]
    async fn an_unreachable_provider_keeps_the_sign_in() {
        let fixture = fixture();
        // Nothing listens on port 1.
        signed_in(&fixture, "http://127.0.0.1:1/token", Some(30), Some("r1")).await;

        assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);

        assert_eq!(fixture.sign_ins.statuses().len(), 1);
    }

    #[tokio::test]
    async fn a_rejected_token_is_renewed_once() {
        let (token_url, _) = token_endpoint(vec![(
            200,
            r#"{"access_token":"second","expires_in":7200}"#,
        )])
        .await;
        let fixture = fixture();
        signed_in(&fixture, &token_url, Some(7200), Some("r1")).await;

        fixture.sign_ins.rejected(ORIGIN, "first").await;

        assert_eq!(
            fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
            "second"
        );
    }

    #[tokio::test]
    async fn a_rejected_token_that_cannot_be_renewed_signs_the_origin_out() {
        let fixture = fixture();
        signed_in(&fixture, "http://127.0.0.1:1/unused", None, None).await;

        fixture.sign_ins.rejected(ORIGIN, "first").await;

        assert!(fixture.sign_ins.statuses().is_empty());
    }

    #[tokio::test]
    async fn a_rejection_of_another_credential_changes_nothing() {
        let fixture = fixture();
        signed_in(&fixture, "http://127.0.0.1:1/unused", None, None).await;

        fixture.sign_ins.rejected(ORIGIN, "typed-by-hand").await;

        assert_eq!(fixture.sign_ins.statuses().len(), 1);
    }

    #[tokio::test]
    async fn a_sign_in_runs_from_the_browser_redirect_to_the_stored_token() {
        let (token_url, requests) = token_endpoint(vec![(
            200,
            r#"{"access_token":"granted","refresh_token":"r1","expires_in":7200}"#,
        )])
        .await;
        let fixture = fixture();
        let provider = Provider {
            token_url,
            ..provider()
        };
        // The "browser": follows the redirect the authorize URL names.
        let open = |url: &str| {
            let url = reqwest::Url::parse(url).unwrap();
            let param = |name: &str| {
                url.query_pairs()
                    .find(|(key, _)| key == name)
                    .unwrap()
                    .1
                    .into_owned()
            };
            let redirect = format!(
                "{}?code=the-code&state={}",
                param("redirect_uri"),
                param("state")
            );
            tokio::spawn(async move { reqwest::get(redirect).await });
            Ok(())
        };

        let status = fixture
            .sign_ins
            .sign_in("https://GitLab.com/", provider, open)
            .await;

        assert_eq!(
            status,
            Ok(SignInStatus {
                origin: ORIGIN.into(),
                persistent: true
            })
        );
        let sent = requests.lock().unwrap()[0].clone();
        assert!(sent.contains("grant_type=authorization_code&code=the-code"));
        assert!(sent.contains("code_verifier="));
        assert_eq!(
            fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
            "granted"
        );
    }

    #[tokio::test]
    async fn a_typed_credential_is_handed_out_until_git_reports_it_rejected() {
        let fixture = fixture();
        let typed = Credential {
            username: "me".into(),
            password: "token".into(),
        };
        fixture.sign_ins.remember_typed(ORIGIN, typed.clone());

        assert_eq!(fixture.sign_ins.credential(ORIGIN).await, Some(typed));

        fixture.sign_ins.rejected(ORIGIN, "token").await;
        assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);
    }

    #[tokio::test]
    async fn a_sign_in_comes_before_what_was_typed() {
        let fixture = fixture();
        fixture.sign_ins.remember_typed(
            ORIGIN,
            Credential {
                username: "me".into(),
                password: "typed".into(),
            },
        );
        signed_in(&fixture, "http://127.0.0.1:1/unused", None, None).await;

        assert_eq!(
            fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
            "first"
        );
    }

    #[tokio::test]
    async fn a_cancelled_sign_in_ends_its_wait() {
        let fixture = Arc::new(fixture());
        let waiting = fixture.clone();
        let sign_in = tokio::spawn(async move {
            waiting
                .sign_ins
                .sign_in(ORIGIN, provider(), |_| Ok(()))
                .await
        });
        while fixture.sign_ins.waiting.lock().unwrap().is_empty() {
            tokio::task::yield_now().await;
        }

        fixture.sign_ins.cancel(ORIGIN);

        assert_eq!(
            sign_in.await.unwrap(),
            Err("The sign-in was cancelled.".to_string())
        );
    }
}
