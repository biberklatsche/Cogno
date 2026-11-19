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
    #[serde(with = "endpoint_id_text")]
    pub endpoint_id: EndpointId,
    /// Only directly - in the local network or at `address` - never over
    /// Cogno's relay.
    #[serde(default, skip_serializing_if = "is_false")]
    pub direct_only: bool,
    /// Where the machine is reached directly: a host name or IP address,
    /// with a port when not the pairing port.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
}

impl PairedMachine {
    /// A machine just paired: reached however it can be.
    pub fn new(name: String, endpoint_id: EndpointId) -> Self {
        Self {
            name,
            endpoint_id,
            direct_only: false,
            address: None,
        }
    }
}

fn is_false(value: &bool) -> bool {
    !value
}

/// What `paired.json` holds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Paired {
    /// Whether paired machines may connect while Cogno runs.
    pub accepting: bool,
    pub machines: Vec<PairedMachine>,
}

impl Default for Paired {
    fn default() -> Self {
        Self {
            accepting: true,
            machines: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct PairedFile {
    version: u32,
    accepting: bool,
    machines: Vec<PairedMachine>,
}

/// The pairing files of one Cogno home.
pub struct Store {
    home: PathBuf,
    /// Held from reading `paired.json` to writing it back: a change never
    /// writes over another one made meanwhile.
    changing: Mutex<()>,
}

impl Store {
    pub fn new(home: &Path) -> Self {
        Self {
            home: home.to_path_buf(),
            changing: Mutex::new(()),
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

    /// The paired machines; none, and accepting, before the first pairing.
    /// A file of a later Cogno is read as far as it is understood - and
    /// `save` refuses to overwrite it.
    pub fn paired(&self) -> io::Result<Paired> {
        match std::fs::read(self.paired_path()) {
            Ok(bytes) => {
                let file: PairedFile = serde_json::from_slice(&bytes).map_err(invalid)?;
                Ok(Paired {
                    accepting: file.accepting,
                    machines: file.machines,
                })
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Paired::default()),
            Err(error) => Err(error),
        }
    }

    /// Changes the paired machines as `change` says, and saves them.
    pub fn change<T>(&self, change: impl FnOnce(&mut Paired) -> T) -> io::Result<T> {
        let _changing = lock(&self.changing);
        let mut paired = self.paired()?;
        let result = change(&mut paired);
        self.save(&paired)?;
        Ok(result)
    }

    fn save(&self, paired: &Paired) -> io::Result<()> {
        if self.written_by_a_later_cogno()? {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "The paired machines were saved by a later Cogno: update this one",
            ));
        }
        let file = PairedFile {
            version: PAIRED_VERSION,
            accepting: paired.accepting,
            machines: paired.machines.clone(),
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

/// An endpoint id in the file as the text iroh shows it.
mod endpoint_id_text {
    use iroh::EndpointId;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(id: &EndpointId, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(id)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<EndpointId, D::Error> {
        String::deserialize(deserializer)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
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
        assert_eq!(store.paired().unwrap(), Paired::default());
        let paired = Paired {
            accepting: false,
            machines: vec![PairedMachine {
                name: "laptop".into(),
                endpoint_id: SecretKey::generate().public(),
                direct_only: true,
                address: Some("192.168.1.20".into()),
            }],
        };

        store.save(&paired).unwrap();

        assert_eq!(store.paired().unwrap(), paired);
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
                            paired.machines.push(PairedMachine::new(
                                format!("machine {n}"),
                                SecretKey::generate().public(),
                            ))
                        })
                        .unwrap()
                })
            })
            .collect();
        for change in changes {
            change.join().unwrap();
        }

        assert_eq!(store.paired().unwrap().machines.len(), 8);
    }

    #[test]
    fn a_file_of_a_later_cogno_is_never_overwritten() {
        let store = store();
        let later = r#"{"version":2,"accepting":true,"machines":[],"groups":[]}"#;
        private_file::write_atomically(&store.paired_path(), later.as_bytes()).unwrap();

        assert!(store.paired().unwrap().accepting);
        assert!(store.save(&Paired::default()).is_err());
        assert_eq!(std::fs::read_to_string(store.paired_path()).unwrap(), later);
    }
}
