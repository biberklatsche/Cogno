//! Pairing with another machine (ARCHITECTURE.md 2.7.3): two machines learn
//! each other once by a short code and then connect over iroh, without ssh.
//!
//! `Pairing` runs this machine's endpoint while the Remote feature is on: it
//! gets codes from the rendezvous, pairs by a code another machine showed,
//! answers the requests of others - asking the user through `PairingEvents`
//! - and unpairs on both sides.

mod frame;
mod handshake;
mod rendezvous;
mod store;

use std::collections::HashMap;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use cogno_host::sync::lock;
use iroh::endpoint::presets;
use iroh::{Endpoint, EndpointAddr, EndpointId, RelayMap, RelayMode, RelayUrl};
use tokio::sync::oneshot;

use handshake::{Reply, Request, PAIR_ALPN};
pub use store::PairedMachine;
use store::{Paired, Store};

/// How long the other machine may take to tell it removed the pairing too.
const UNPAIR_PATIENCE: Duration = Duration::from_secs(5);

/// Cogno's own server (ARCHITECTURE.md 2.7.3): the relay, which is also where
/// each machine is found by its id, and the rendezvous behind it.
#[derive(Clone)]
pub struct Server {
    pub relay_url: RelayUrl,
    pub relay_map: RelayMap,
    pub rendezvous: EndpointId,
    /// Tests run a relay with a certificate of their own.
    #[cfg(test)]
    pub insecure: bool,
}

impl Server {
    /// Cogno's own server, once it runs; without it pairing reports that
    /// it cannot reach it.
    pub fn cogno() -> Option<Server> {
        None
    }

    /// Where a machine is found that has only its id to go by.
    fn address_of(&self, id: EndpointId) -> EndpointAddr {
        EndpointAddr::new(id).with_relay_url(self.relay_url.clone())
    }
}

/// What the user sees of pairing; told through `PairingEvents::changed`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingView {
    pub accepting: bool,
    pub machines: Vec<PairedMachine>,
    /// The code this machine shows, while it is valid.
    pub code: Option<ShownCode>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShownCode {
    pub code: String,
    pub expires_in_secs: u64,
}

/// A machine asks to be paired with this one.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairRequest {
    pub id: u64,
    /// How the asking machine calls itself, when it says.
    pub name: Option<String>,
    /// The number the asking machine shows too.
    pub check: String,
}

/// Where pairing tells the app what happened.
pub trait PairingEvents: Send + Sync + 'static {
    /// A machine asks to pair: `Pairing::answer` with the user's decision.
    fn request(&self, request: PairRequest);
    /// The request is over: answered, given up or timed out.
    fn request_ended(&self, id: u64);
    /// What `Pairing::view` shows changed.
    fn changed(&self);
}

/// Why pairing failed, as the user is told.
#[derive(Debug)]
pub enum PairingError {
    /// Pairing is off: the Remote feature is switched off.
    Off,
    /// The rendezvous or the other machine was not reached.
    Unreachable(String),
    /// No machine showed that code, or no longer.
    UnknownCode,
    /// The other machine declined, or its user did not answer in time.
    Declined,
    /// The files in Cogno's home could not be read or written.
    Storage(io::Error),
}

impl From<io::Error> for PairingError {
    fn from(error: io::Error) -> Self {
        PairingError::Storage(error)
    }
}

/// The code this machine shows, until it is used or runs out.
struct OpenCode {
    code: String,
    until: Instant,
}

#[derive(Clone)]
pub struct Pairing(Arc<Inner>);

struct Inner {
    store: Store,
    server: Server,
    events: Arc<dyn PairingEvents>,
    endpoint: Mutex<Option<Endpoint>>,
    open_code: Mutex<Option<OpenCode>>,
    requests: Mutex<HashMap<u64, oneshot::Sender<Option<String>>>>,
    next_request: AtomicU64,
}

impl Pairing {
    pub fn new(home: &Path, server: Server, events: Arc<dyn PairingEvents>) -> Self {
        Self(Arc::new(Inner {
            store: Store::new(home),
            server,
            events,
            endpoint: Mutex::new(None),
            open_code: Mutex::new(None),
            requests: Mutex::new(HashMap::new()),
            next_request: AtomicU64::new(1),
        }))
    }

    /// Starts this machine's endpoint: the Remote feature was switched on.
    pub async fn enable(&self) -> Result<(), PairingError> {
        if lock(&self.0.endpoint).is_some() {
            return Ok(());
        }
        let builder = Endpoint::builder(presets::Minimal)
            .secret_key(self.0.store.key()?)
            .relay_mode(RelayMode::Custom(self.0.server.relay_map.clone()))
            .alpns(vec![PAIR_ALPN.to_vec()]);
        #[cfg(test)]
        let builder = if self.0.server.insecure {
            builder.ca_tls_config(iroh::tls::CaTlsConfig::insecure_skip_verify())
        } else {
            builder
        };
        let endpoint = builder
            .bind()
            .await
            .map_err(|error| PairingError::Unreachable(error.to_string()))?;
        let accepting = endpoint.clone();
        let pairing = self.clone();
        tokio::spawn(async move {
            while let Some(incoming) = accepting.accept().await {
                let pairing = pairing.clone();
                tokio::spawn(async move {
                    if let Ok(connection) = incoming.await {
                        pairing.answer_connection(connection).await;
                    }
                });
            }
        });
        *lock(&self.0.endpoint) = Some(endpoint);
        Ok(())
    }

    /// Stops the endpoint: the Remote feature was switched off. Nothing is
    /// reachable any more; a code shown is gone, a request is declined.
    pub async fn disable(&self) {
        let endpoint = lock(&self.0.endpoint).take();
        *lock(&self.0.open_code) = None;
        let requests: Vec<_> = lock(&self.0.requests).drain().collect();
        for (id, answer) in requests {
            let _ = answer.send(None);
            self.0.events.request_ended(id);
        }
        if let Some(endpoint) = endpoint {
            endpoint.close().await;
        }
        self.0.events.changed();
    }

    pub fn view(&self) -> Result<PairingView, PairingError> {
        let paired = self.0.store.paired()?;
        let code = lock(&self.0.open_code).as_ref().and_then(|open| {
            let left = open.until.saturating_duration_since(Instant::now());
            (!left.is_zero()).then(|| ShownCode {
                code: open.code.clone(),
                expires_in_secs: left.as_secs(),
            })
        });
        Ok(PairingView {
            accepting: paired.accepting,
            machines: paired.machines,
            code,
        })
    }

    /// A code for another machine to pair with this one; one shown before
    /// is gone.
    pub async fn create_code(&self) -> Result<ShownCode, PairingError> {
        let endpoint = self.endpoint()?;
        let rendezvous = self.0.server.address_of(self.0.server.rendezvous);
        let code = rendezvous::register(&endpoint, rendezvous)
            .await
            .map_err(rendezvous_failure)?;
        *lock(&self.0.open_code) = Some(OpenCode {
            code: handshake::normalize_code(&code.code),
            until: Instant::now() + code.expires_in,
        });
        self.0.events.changed();
        Ok(ShownCode {
            code: code.code,
            expires_in_secs: code.expires_in.as_secs(),
        })
    }

    pub fn cancel_code(&self) {
        if lock(&self.0.open_code).take().is_some() {
            self.0.events.changed();
        }
    }

    /// Pairs with the machine that shows `code`. `on_check` gets the check
    /// number while that machine asks its user. The other machine is named
    /// as it calls itself, unless one of `taken` - names of other remotes -
    /// or of a paired machine has it.
    pub async fn pair_by_code(
        &self,
        code: &str,
        taken: &[String],
        on_check: impl FnOnce(String),
    ) -> Result<PairedMachine, PairingError> {
        let endpoint = self.endpoint()?;
        let code = handshake::normalize_code(code);
        let rendezvous = self.0.server.address_of(self.0.server.rendezvous);
        let peer = rendezvous::resolve(&endpoint, rendezvous, &code)
            .await
            .map_err(rendezvous_failure)?;
        on_check(handshake::check_number(endpoint.id(), peer, &code));
        let request = Request::Pair {
            code,
            name: cogno_host::identity::machine_name(),
        };
        let reply = handshake::ask(
            &endpoint,
            self.0.server.address_of(peer),
            &request,
            handshake::CONFIRM_PATIENCE,
        )
        .await
        .map_err(|error| PairingError::Unreachable(error.to_string()))?;
        match reply {
            Reply::Accepted { name } => {
                let mut paired = self.0.store.paired()?;
                let name = unique_name(name.as_deref(), taken, &paired);
                let machine = PairedMachine {
                    name,
                    endpoint_id: peer,
                };
                paired.machines.retain(|known| known.endpoint_id != peer);
                paired.machines.push(machine.clone());
                self.0.store.save(&paired)?;
                self.0.events.changed();
                Ok(machine)
            }
            Reply::WrongCode => Err(PairingError::UnknownCode),
            _ => Err(PairingError::Declined),
        }
    }

    /// The user's answer to request `id`: the name to pair the machine
    /// under, or `None` to decline.
    pub fn answer(&self, id: u64, name: Option<String>) {
        if let Some(answer) = lock(&self.0.requests).remove(&id) {
            let _ = answer.send(name);
        }
    }

    pub fn set_accepting(&self, accepting: bool) -> Result<(), PairingError> {
        let mut paired = self.0.store.paired()?;
        paired.accepting = accepting;
        self.0.store.save(&paired)?;
        self.0.events.changed();
        Ok(())
    }

    pub fn rename(&self, previous: &str, name: &str) -> Result<(), PairingError> {
        let mut paired = self.0.store.paired()?;
        for machine in paired.machines.iter_mut().filter(|m| m.name == previous) {
            machine.name = name.to_string();
        }
        self.0.store.save(&paired)?;
        self.0.events.changed();
        Ok(())
    }

    /// Removes the pairing with `name` here, and tells that machine. Whether
    /// it heard: when not, it refuses this one the next time.
    pub async fn remove(&self, name: &str) -> Result<bool, PairingError> {
        let mut paired = self.0.store.paired()?;
        let Some(index) = paired.machines.iter().position(|m| m.name == name) else {
            return Ok(true);
        };
        let machine = paired.machines.remove(index);
        self.0.store.save(&paired)?;
        self.0.events.changed();
        let Ok(endpoint) = self.endpoint() else {
            return Ok(false);
        };
        let told = handshake::ask(
            &endpoint,
            self.0.server.address_of(machine.endpoint_id),
            &Request::Unpair,
            UNPAIR_PATIENCE,
        )
        .await;
        Ok(matches!(told, Ok(Reply::Done)))
    }

    fn endpoint(&self) -> Result<Endpoint, PairingError> {
        lock(&self.0.endpoint).clone().ok_or(PairingError::Off)
    }

    /// Answers what another machine asks on `PAIR_ALPN`.
    async fn answer_connection(&self, connection: iroh::endpoint::Connection) {
        let Ok(incoming) = handshake::receive(connection).await else {
            return;
        };
        let reply = match incoming.request.clone() {
            Request::Pair { code, name } => self.answer_pairing(incoming.peer, &code, name).await,
            Request::Unpair => {
                self.forget(incoming.peer);
                Reply::Done
            }
            Request::Unknown => return,
        };
        let _ = incoming.reply(&reply).await;
    }

    async fn answer_pairing(&self, peer: EndpointId, code: &str, name: Option<String>) -> Reply {
        let code = handshake::normalize_code(code);
        // The code is used up, whatever the user says.
        let shown = {
            let mut open = lock(&self.0.open_code);
            match open.as_ref() {
                Some(shown) if shown.code == code && Instant::now() < shown.until => open.take(),
                _ => None,
            }
        };
        if shown.is_none() {
            return Reply::WrongCode;
        }
        self.0.events.changed();
        let Ok(endpoint) = self.endpoint() else {
            return Reply::Declined;
        };
        let id = self.0.next_request.fetch_add(1, Ordering::Relaxed);
        let (answer, answered) = oneshot::channel();
        lock(&self.0.requests).insert(id, answer);
        self.0.events.request(PairRequest {
            id,
            name: name.clone(),
            check: handshake::check_number(endpoint.id(), peer, &code),
        });
        let decision = tokio::time::timeout(handshake::CONFIRM_PATIENCE, answered).await;
        lock(&self.0.requests).remove(&id);
        self.0.events.request_ended(id);
        let Ok(Ok(Some(chosen))) = decision else {
            return Reply::Declined;
        };
        let saved = self.0.store.paired().and_then(|mut paired| {
            paired.machines.retain(|known| known.endpoint_id != peer);
            paired.machines.push(PairedMachine {
                name: chosen,
                endpoint_id: peer,
            });
            self.0.store.save(&paired)
        });
        if saved.is_err() {
            return Reply::Declined;
        }
        self.0.events.changed();
        Reply::Accepted {
            name: cogno_host::identity::machine_name(),
        }
    }

    /// The machine `peer` removed the pairing: so does this one.
    fn forget(&self, peer: EndpointId) {
        let Ok(mut paired) = self.0.store.paired() else {
            return;
        };
        let before = paired.machines.len();
        paired
            .machines
            .retain(|machine| machine.endpoint_id != peer);
        if paired.machines.len() != before && self.0.store.save(&paired).is_ok() {
            self.0.events.changed();
        }
    }
}

/// `wanted`, or - when that is taken or missing - the first of "wanted 2",
/// "wanted 3", ... that is free.
fn unique_name(wanted: Option<&str>, taken: &[String], paired: &Paired) -> String {
    let base = wanted
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or("machine");
    let is_free = |name: &str| {
        !taken.iter().any(|taken| taken == name) && !paired.machines.iter().any(|m| m.name == name)
    };
    if is_free(base) {
        return base.to_string();
    }
    (2..)
        .map(|n| format!("{base} {n}"))
        .find(|name| is_free(name))
        .expect("a free name")
}

fn rendezvous_failure(failure: rendezvous::Failure) -> PairingError {
    match failure {
        rendezvous::Failure::NoSuchCode => PairingError::UnknownCode,
        rendezvous::Failure::Unreachable(error) => PairingError::Unreachable(error.to_string()),
        rendezvous::Failure::Refused(reason) => PairingError::Unreachable(reason),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use iroh::SecretKey;

    /// What a test's pairing told the app.
    #[derive(Default)]
    struct Told {
        requests: Mutex<Vec<PairRequest>>,
        ended: Mutex<Vec<u64>>,
    }

    impl PairingEvents for Told {
        fn request(&self, request: PairRequest) {
            lock(&self.requests).push(request);
        }
        fn request_ended(&self, id: u64) {
            lock(&self.ended).push(id);
        }
        fn changed(&self) {}
    }

    /// A relay and a rendezvous of the test's own, as Cogno's server is.
    struct TestServer {
        server: Server,
        _relay: Box<dyn std::any::Any + Send>,
        _rendezvous: Endpoint,
    }

    async fn test_server(code: &'static str) -> TestServer {
        let (relay_map, relay_url, relay) = iroh::test_utils::run_relay_server().await.unwrap();
        let rendezvous = Endpoint::builder(presets::Minimal)
            .secret_key(SecretKey::generate())
            .relay_mode(RelayMode::Custom(relay_map.clone()))
            .ca_tls_config(iroh::tls::CaTlsConfig::insecure_skip_verify())
            .alpns(vec![rendezvous::RENDEZVOUS_ALPN.to_vec()])
            .bind()
            .await
            .unwrap();
        rendezvous.online().await;
        rendezvous::test_support::serve(rendezvous.clone(), code);
        TestServer {
            server: Server {
                relay_url,
                relay_map,
                rendezvous: rendezvous.id(),
                insecure: true,
            },
            _relay: Box::new(relay),
            _rendezvous: rendezvous,
        }
    }

    fn home() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("cogno-pairing-{}", uuid::Uuid::new_v4().simple()))
    }

    async fn machine(server: &Server) -> (Pairing, Arc<Told>) {
        let told = Arc::new(Told::default());
        let pairing = Pairing::new(&home(), server.clone(), told.clone());
        pairing.enable().await.unwrap();
        let endpoint = lock(&pairing.0.endpoint).clone().unwrap();
        endpoint.online().await;
        (pairing, told)
    }

    /// Answers the first request `told` hears with `name`.
    fn answer_when_asked(pairing: &Pairing, told: &Arc<Told>, name: Option<&'static str>) {
        let pairing = pairing.clone();
        let told = told.clone();
        tokio::spawn(async move {
            loop {
                let asked = lock(&told.requests).first().cloned();
                if let Some(request) = asked {
                    pairing.answer(request.id, name.map(str::to_string));
                    return;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        });
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn two_machines_pair_by_a_code_and_both_see_the_same_check_number() {
        let test = test_server("K7Q4MX").await;
        let (office, office_told) = machine(&test.server).await;
        let (laptop, _) = machine(&test.server).await;
        let shown = office.create_code().await.unwrap();
        assert_eq!(office.view().unwrap().code.unwrap().code, "K7Q4MX");
        answer_when_asked(&office, &office_told, Some("laptop"));

        let mut seen_check = None;
        let paired = laptop
            .pair_by_code("k7q-4mx", &[], |check| seen_check = Some(check))
            .await
            .unwrap();

        assert_eq!(shown.code, "K7Q4MX");
        let asked = lock(&office_told.requests)[0].clone();
        assert_eq!(seen_check.as_deref(), Some(asked.check.as_str()));
        assert_eq!(
            paired.endpoint_id,
            lock(&office.0.endpoint).clone().unwrap().id()
        );
        assert_eq!(office.view().unwrap().machines[0].name, "laptop");
        assert_eq!(laptop.view().unwrap().machines.len(), 1);
        // Used up: shown no more.
        assert!(office.view().unwrap().code.is_none());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_declined_pairing_pairs_neither() {
        let test = test_server("K7Q4MX").await;
        let (office, office_told) = machine(&test.server).await;
        let (laptop, _) = machine(&test.server).await;
        office.create_code().await.unwrap();
        answer_when_asked(&office, &office_told, None);

        let paired = laptop.pair_by_code("K7Q4MX", &[], |_| {}).await;

        assert!(matches!(paired, Err(PairingError::Declined)));
        assert!(office.view().unwrap().machines.is_empty());
        assert!(laptop.view().unwrap().machines.is_empty());
        assert_eq!(lock(&office_told.ended).len(), 1);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn removing_a_pairing_removes_it_on_the_other_machine_too() {
        let test = test_server("K7Q4MX").await;
        let (office, office_told) = machine(&test.server).await;
        let (laptop, _) = machine(&test.server).await;
        office.create_code().await.unwrap();
        answer_when_asked(&office, &office_told, Some("laptop"));
        let paired = laptop.pair_by_code("K7Q4MX", &[], |_| {}).await.unwrap();

        let told = laptop.remove(&paired.name).await.unwrap();

        assert!(told);
        assert!(laptop.view().unwrap().machines.is_empty());
        assert!(office.view().unwrap().machines.is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_code_nobody_shows_pairs_nothing() {
        let test = test_server("K7Q4MX").await;
        let (laptop, _) = machine(&test.server).await;

        let paired = laptop.pair_by_code("ZZZZZZ", &[], |_| {}).await;

        assert!(matches!(paired, Err(PairingError::UnknownCode)));
    }

    #[test]
    fn a_name_that_is_taken_gets_a_number() {
        let paired = Paired {
            accepting: true,
            machines: vec![PairedMachine {
                name: "laptop 2".into(),
                endpoint_id: SecretKey::generate().public(),
            }],
        };
        assert_eq!(unique_name(Some("office"), &[], &paired), "office");
        assert_eq!(
            unique_name(Some("laptop"), &["laptop".into()], &paired),
            "laptop 3"
        );
        assert_eq!(unique_name(None, &[], &paired), "machine");
    }
}
