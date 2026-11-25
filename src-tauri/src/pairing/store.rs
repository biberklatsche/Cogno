//! What pairing keeps on disk (ARCHITECTURE.md 2.7.3): this machine's secret
//! key and the machines it is paired with. Both lie in Cogno's home, only
//! their owner can read them, and only the app writes them.

use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use cogno_host::private_file;
use cogno_host::sync::lock;
use iroh::{EndpointId, SecretKey};
use serde::{Deserialize, Serialize};

/// This machine's secret key, hex: its identity towards paired machines.
const KEY_FILE_NAME: &str = "pairing-key";
/// The machines this one is paired with.
const PAIRED_FILE_NAME: &str = "paired.json";
/// The format of `paired.json` this build writes.
const PAIRED_VERSION: u32 = 1;

/// A machine this one is paired with, under the name the user knows it by.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedMachine {
    pub name: String,
    pub endpoint_id: EndpointId,
}

#[derive(Serialize, Deserialize)]
struct PairedFile {
    version: u32,
    machines: Vec<PairedMachine>,
}

/// The pairing files of one Cogno home.
pub struct Store {
    home: PathBuf,
    /// The paired machines as `paired.json` has them, once read: only this
    /// app writes the file. Held from reading to writing back, so a change
    /// never writes over another one made meanwhile.
    paired: Mutex<Option<Vec<PairedMachine>>>,
}

impl Store {
    pub fn new(home: &Path) -> Self {
        Self {
            home: home.to_path_buf(),
            paired: Mutex::new(None),
        }
    }

    /// This machine's secret key, made on first use and kept from then on.
    /// Without the file there is a new identity, and every pairing is gone.
    pub fn key(&self) -> io::Result<SecretKey> {
        let path = self.home.join(KEY_FILE_NAME);
        match std::fs::read_to_string(&path) {
            Ok(text) => parse_key(text.trim()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                let key = SecretKey::generate();
                private_file::write_atomically(&path, hex::encode(key.to_bytes()).as_bytes())?;
                Ok(key)
            }
            Err(error) => Err(error),
        }
    }

    /// The paired machines; none before the first pairing.
    /// A file of a later Cogno is read as far as it is understood - and
    /// `save` refuses to overwrite it.
    pub fn paired(&self) -> io::Result<Vec<PairedMachine>> {
        let mut known = lock(&self.paired);
        self.known(&mut known).cloned()
    }

    /// What `known` holds, read from the file the first time.
    fn known<'a>(
        &self,
        known: &'a mut Option<Vec<PairedMachine>>,
    ) -> io::Result<&'a mut Vec<PairedMachine>> {
        if known.is_none() {
            *known = Some(self.read()?);
        }
        Ok(known.as_mut().expect("read above"))
    }

    fn read(&self) -> io::Result<Vec<PairedMachine>> {
        match std::fs::read(self.paired_path()) {
            Ok(bytes) => {
                let file: PairedFile = serde_json::from_slice(&bytes).map_err(invalid)?;
                Ok(file.machines)
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(error) => Err(error),
        }
    }

    /// Changes the paired machines as `change` says, and saves them.
    pub fn change<T>(&self, change: impl FnOnce(&mut Vec<PairedMachine>) -> T) -> io::Result<T> {
        let mut known = lock(&self.paired);
        let mut paired = self.known(&mut known)?.clone();
        let result = change(&mut paired);
        self.save(&paired)?;
        *known = Some(paired);
        Ok(result)
    }

    fn save(&self, paired: &[PairedMachine]) -> io::Result<()> {
        if self.written_by_a_later_cogno()? {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "The paired machines were saved by a later Cogno: update this one",
            ));
        }
        let file = PairedFile {
            version: PAIRED_VERSION,
            machines: paired.to_vec(),
        };
        let content = serde_json::to_vec_pretty(&file).map_err(invalid)?;
        private_file::write_atomically(&self.paired_path(), &content)
    }

    fn written_by_a_later_cogno(&self) -> io::Result<bool> {
        #[derive(Deserialize)]
        struct Version {
            version: u32,
        }
        match std::fs::read(self.paired_path()) {
            Ok(bytes) => Ok(serde_json::from_slice::<Version>(&bytes)
                .map_err(invalid)?
                .version
                > PAIRED_VERSION),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(error),
        }
    }

    fn paired_path(&self) -> PathBuf {
        self.home.join(PAIRED_FILE_NAME)
    }
}

fn parse_key(text: &str) -> io::Result<SecretKey> {
    let bytes: [u8; 32] = hex::decode(text)
        .map_err(invalid)?
        .try_into()
        .map_err(|_| invalid("the pairing key has the wrong length"))?;
    Ok(SecretKey::from_bytes(&bytes))
}

fn invalid(error: impl std::fmt::Display) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> Store {
        Store::new(
            &std::env::temp_dir().join(format!("cogno-pairing-{}", uuid::Uuid::new_v4().simple())),
        )
    }

    #[test]
    fn the_key_is_made_once_and_kept() {
        let store = store();

        let first = store.key().unwrap();
        let again = store.key().unwrap();

        assert_eq!(first.public(), again.public());
    }

    #[test]
    fn paired_machines_come_back_as_they_were_saved() {
        let store = store();
        assert!(store.paired().unwrap().is_empty());
        let paired = vec![PairedMachine {
            name: "laptop".into(),
            endpoint_id: SecretKey::generate().public(),
        }];

        store.change(|machines| *machines = paired.clone()).unwrap();

        assert_eq!(store.paired().unwrap(), paired);
        // Also for the app started the next time.
        assert_eq!(Store::new(&store.home).paired().unwrap(), paired);
    }

    #[test]
    fn changes_made_at_once_all_land() {
        let store = std::sync::Arc::new(store());

        let changes: Vec<_> = (0..8)
            .map(|n| {
                let store = store.clone();
                std::thread::spawn(move || {
                    store
                        .change(|paired| {
                            paired.push(PairedMachine {
                                name: format!("machine {n}"),
                                endpoint_id: SecretKey::generate().public(),
                            })
                        })
                        .unwrap()
                })
            })
            .collect();
        for change in changes {
            change.join().unwrap();
        }

        assert_eq!(store.paired().unwrap().len(), 8);
    }

    #[test]
    fn a_file_of_a_later_cogno_is_never_overwritten() {
        let store = store();
        let later = r#"{"version":2,"machines":[],"groups":[]}"#;
        private_file::write_atomically(&store.paired_path(), later.as_bytes()).unwrap();

        assert!(store.paired().unwrap().is_empty());
        assert!(store.save(&[]).is_err());
        assert_eq!(std::fs::read_to_string(store.paired_path()).unwrap(), later);
    }
}
