//! Where sign-ins are kept. The tokens live in the system keychain, access and
//! refresh token as entries of their own (Windows holds 2560 bytes per
//! entry). What is no secret - the provider's endpoints, when the access
//! token runs out - stands in `sign-ins.json` in the Cogno home, so the
//! backend knows which origins are signed in without listing the keychain.
//!
//! Two rules keep the two in step. An index entry whose access token is gone
//! from the keychain counts as signed out and is dropped when it is read. And
//! a sign-in the keychain did not take (Linux without a Secret Service) is
//! held in memory until Cogno exits and never reaches the index.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

const INDEX_FILE: &str = "sign-ins.json";

/// What the feature that offers a sign-in says about its provider. Kept with
/// the sign-in, because a token is refreshed without any window around.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub authorize_url: String,
    pub token_url: String,
    pub client_id: String,
    /// Only where the provider demands one from a desktop app; public then.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    pub scopes: Vec<String>,
    /// The name git sends next to the token.
    pub username: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignIn {
    pub provider: Provider,
    /// Seconds since the epoch; `None` for a token that does not expire.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tokens {
    pub access: String,
    pub refresh: Option<String>,
}

/// A place for secrets, named by key. The keychain in the app, a map in tests.
pub trait Secrets: Send + Sync {
    fn get(&self, key: &str) -> Result<Option<String>, String>;
    fn set(&self, key: &str, value: &str) -> Result<(), String>;
    fn delete(&self, key: &str);
}

/// The system keychain, under one service name per build: a dev instance
/// never touches the sign-ins of the release instance.
pub struct Keychain {
    service: String,
}

impl Keychain {
    pub fn new(dev_mode: bool) -> Self {
        Self {
            service: if dev_mode { "cogno-dev" } else { "cogno" }.to_string(),
        }
    }

    fn entry(&self, key: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(&self.service, key).map_err(|error| error.to_string())
    }
}

impl Secrets for Keychain {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        match self.entry(key)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    fn set(&self, key: &str, value: &str) -> Result<(), String> {
        self.entry(key)?
            .set_password(value)
            .map_err(|error| error.to_string())
    }

    fn delete(&self, key: &str) {
        if let Ok(entry) = self.entry(key) {
            let _ = entry.delete_credential();
        }
    }
}

#[derive(Default)]
struct Memory(Mutex<HashMap<String, String>>);

impl Secrets for Memory {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        Ok(self.0.lock().unwrap().get(key).cloned())
    }

    fn set(&self, key: &str, value: &str) -> Result<(), String> {
        self.0
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn delete(&self, key: &str) {
        self.0.lock().unwrap().remove(key);
    }
}

struct Held {
    sign_in: SignIn,
    /// In the keychain and the index; `false` for one held until Cogno exits.
    persistent: bool,
}

pub struct Store {
    index_path: PathBuf,
    keychain: Box<dyn Secrets>,
    memory: Memory,
    held: Mutex<BTreeMap<String, Held>>,
}

fn access_key(origin: &str) -> String {
    format!("{origin}#access")
}

fn refresh_key(origin: &str) -> String {
    format!("{origin}#refresh")
}

impl Store {
    /// Reads the index; a missing or unreadable one means nobody is signed in.
    pub fn open(cogno_home: PathBuf, keychain: Box<dyn Secrets>) -> Self {
        let index_path = cogno_home.join(INDEX_FILE);
        let index: BTreeMap<String, SignIn> = fs::read_to_string(&index_path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default();
        let held = index
            .into_iter()
            .map(|(origin, sign_in)| {
                (
                    origin,
                    Held {
                        sign_in,
                        persistent: true,
                    },
                )
            })
            .collect();
        Self {
            index_path,
            keychain,
            memory: Memory::default(),
            held: Mutex::new(held),
        }
    }

    /// Every origin signed in, with whether the sign-in outlives this run.
    pub fn origins(&self) -> Vec<(String, bool)> {
        self.held
            .lock()
            .unwrap()
            .iter()
            .map(|(origin, held)| (origin.clone(), held.persistent))
            .collect()
    }

    /// Keeps a sign-in, replacing the one before. Returns whether the keychain
    /// took it; if not, it is held in memory until Cogno exits.
    pub fn put(&self, origin: &str, sign_in: SignIn, tokens: &Tokens) -> bool {
        self.forget_secrets(origin);
        let persistent = self.write(self.keychain.as_ref(), origin, tokens).is_ok();
        if !persistent {
            // A half-written pair must not look like a sign-in on the next start.
            self.keychain.delete(&access_key(origin));
            self.keychain.delete(&refresh_key(origin));
            let _ = self.write(&self.memory, origin, tokens);
        }
        self.held.lock().unwrap().insert(
            origin.to_string(),
            Held {
                sign_in,
                persistent,
            },
        );
        self.save_index();
        persistent
    }

    fn write(&self, secrets: &dyn Secrets, origin: &str, tokens: &Tokens) -> Result<(), String> {
        secrets.set(&access_key(origin), &tokens.access)?;
        match &tokens.refresh {
            Some(refresh) => secrets.set(&refresh_key(origin), refresh),
            None => {
                secrets.delete(&refresh_key(origin));
                Ok(())
            }
        }
    }

    /// The sign-in of an origin with its tokens. An origin whose access token
    /// is gone from the keychain is signed out here.
    pub fn get(&self, origin: &str) -> Option<(SignIn, Tokens)> {
        let (sign_in, persistent) = {
            let held = self.held.lock().unwrap();
            let entry = held.get(origin)?;
            (entry.sign_in.clone(), entry.persistent)
        };
        let secrets: &dyn Secrets = if persistent {
            self.keychain.as_ref()
        } else {
            &self.memory
        };
        match secrets.get(&access_key(origin)) {
            Ok(Some(access)) => {
                let refresh = secrets.get(&refresh_key(origin)).ok().flatten();
                Some((sign_in, Tokens { access, refresh }))
            }
            Ok(None) => {
                self.remove(origin);
                None
            }
            // The keychain did not answer (locked, no access): not signed out,
            // just not usable right now.
            Err(error) => {
                log::warn!(target: "sign_ins", "keychain read for {origin} failed: {error}");
                None
            }
        }
    }

    /// Signs an origin out. Returns whether it was signed in.
    pub fn remove(&self, origin: &str) -> bool {
        let removed = self.held.lock().unwrap().remove(origin).is_some();
        self.forget_secrets(origin);
        if removed {
            self.save_index();
        }
        removed
    }

    fn forget_secrets(&self, origin: &str) {
        for key in [access_key(origin), refresh_key(origin)] {
            self.keychain.delete(&key);
            self.memory.delete(&key);
        }
    }

    fn save_index(&self) {
        let index: BTreeMap<String, SignIn> = self
            .held
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, held)| held.persistent)
            .map(|(origin, held)| (origin.clone(), held.sign_in.clone()))
            .collect();
        if let Err(error) = write_private(
            &self.index_path,
            &serde_json::to_string_pretty(&index).unwrap_or_default(),
        ) {
            log::error!(target: "sign_ins", "cannot write {}: {error}", self.index_path.display());
        }
    }
}

/// Writes a file only the user can read, replacing it in one step.
pub fn write_private(path: &std::path::Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let staged = path.with_extension("tmp");
    fs::write(&staged, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&staged, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(&staged, path)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::sync::Arc;

    /// A keychain that can be told to refuse, and that outlives a store.
    #[derive(Default, Clone)]
    pub struct FakeKeychain {
        pub entries: Arc<Mutex<HashMap<String, String>>>,
        pub refuses: Arc<Mutex<bool>>,
    }

    impl Secrets for FakeKeychain {
        fn get(&self, key: &str) -> Result<Option<String>, String> {
            Ok(self.entries.lock().unwrap().get(key).cloned())
        }

        fn set(&self, key: &str, value: &str) -> Result<(), String> {
            if *self.refuses.lock().unwrap() {
                return Err("no secret service".into());
            }
            self.entries
                .lock()
                .unwrap()
                .insert(key.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, key: &str) {
            self.entries.lock().unwrap().remove(key);
        }
    }

    pub fn temp_home() -> PathBuf {
        std::env::temp_dir().join(format!("cogno-sign-ins-{}", uuid::Uuid::new_v4()))
    }

    pub fn provider() -> Provider {
        Provider {
            authorize_url: "https://gitlab.com/oauth/authorize".into(),
            token_url: "https://gitlab.com/oauth/token".into(),
            client_id: "client".into(),
            client_secret: None,
            scopes: vec!["write_repository".into()],
            username: "oauth2".into(),
        }
    }

    fn sign_in() -> SignIn {
        SignIn {
            provider: provider(),
            expires_at: Some(1_000),
        }
    }

    fn tokens() -> Tokens {
        Tokens {
            access: "access".into(),
            refresh: Some("refresh".into()),
        }
    }

    const ORIGIN: &str = "https://gitlab.com";

    #[test]
    fn a_sign_in_survives_a_restart_with_its_tokens_in_the_keychain_only() {
        let home = temp_home();
        let keychain = FakeKeychain::default();
        let store = Store::open(home.clone(), Box::new(keychain.clone()));

        assert!(store.put(ORIGIN, sign_in(), &tokens()));

        let index = fs::read_to_string(home.join(INDEX_FILE)).unwrap();
        assert!(!index.contains("access\"") && !index.contains("refresh\""));
        let reopened = Store::open(home.clone(), Box::new(keychain));
        assert_eq!(reopened.get(ORIGIN), Some((sign_in(), tokens())));
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn an_index_entry_without_its_keychain_entry_is_signed_out() {
        let home = temp_home();
        let keychain = FakeKeychain::default();
        let store = Store::open(home.clone(), Box::new(keychain.clone()));
        store.put(ORIGIN, sign_in(), &tokens());
        keychain.entries.lock().unwrap().clear();

        assert_eq!(store.get(ORIGIN), None);

        assert!(store.origins().is_empty());
        assert!(Store::open(home.clone(), Box::new(keychain))
            .origins()
            .is_empty());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn without_a_keychain_a_sign_in_lasts_until_the_process_ends() {
        let home = temp_home();
        let keychain = FakeKeychain::default();
        *keychain.refuses.lock().unwrap() = true;
        let store = Store::open(home.clone(), Box::new(keychain.clone()));

        assert!(!store.put(ORIGIN, sign_in(), &tokens()));

        assert_eq!(store.get(ORIGIN), Some((sign_in(), tokens())));
        assert_eq!(store.origins(), vec![(ORIGIN.to_string(), false)]);
        assert!(Store::open(home.clone(), Box::new(keychain))
            .origins()
            .is_empty());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn signing_out_takes_index_entry_and_tokens_away() {
        let home = temp_home();
        let keychain = FakeKeychain::default();
        let store = Store::open(home.clone(), Box::new(keychain.clone()));
        store.put(ORIGIN, sign_in(), &tokens());

        assert!(store.remove(ORIGIN));

        assert!(keychain.entries.lock().unwrap().is_empty());
        assert!(!store.remove(ORIGIN));
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn a_token_without_refresh_drops_the_refresh_token_before_it() {
        let home = temp_home();
        let keychain = FakeKeychain::default();
        let store = Store::open(home.clone(), Box::new(keychain.clone()));
        store.put(ORIGIN, sign_in(), &tokens());

        store.put(
            ORIGIN,
            sign_in(),
            &Tokens {
                access: "next".into(),
                refresh: None,
            },
        );

        assert_eq!(store.get(ORIGIN).unwrap().1.refresh, None);
        fs::remove_dir_all(home).unwrap();
    }
}
