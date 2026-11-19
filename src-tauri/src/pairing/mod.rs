//! Pairing with another machine (ARCHITECTURE.md 2.7.3): two machines learn
//! each other once by a short code and then connect over iroh, without ssh.
//!
//! `Pairing` runs this machine's endpoint while the Remote feature is on: it
//! gets codes from the rendezvous, pairs by a code another machine showed,
//! answers the requests of others (asking the user through `PairingEvents`)
//! and unpairs on both sides. It accepts the connections of paired machines
//! and passes them to this machine's daemon, and dials them.

mod dial;
mod frame;
mod handshake;
mod rendezvous;
mod store;

use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use cogno_host::sync::lock;
use iroh::endpoint::presets;
use iroh::{Endpoint, EndpointAddr, EndpointId, RelayMap, RelayMode, RelayUrl};
use tokio::sync::oneshot;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
pub use dial::Dialing;
use dial::{refusal, HOST_ALPN};
use handshake::{Reply, Request, PAIR_ALPN};
pub use store::PairedMachine;
use store::{Paired, Store};

/// How long the other machine may take to tell it removed the pairing too.
const UNPAIR_PATIENCE: Duration = Duration::from_secs(5);
/// The UDP port this machine is reached at directly, when it is free: an
/// address entered on another machine needs no port then.
pub const PAIRING_PORT: u16 = 7844;
/// The name paired machines announce themselves under in the local network
/// (`_cogno._udp`; macOS lists it in `NSBonjourServices`).
const LOCAL_SERVICE_NAME: &str = "cogno";

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
    /// Where this machine is reached directly, while pairing is on: what to
    /// enter as its address on another machine.
    pub addresses: Vec<String>,
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
    /// This machine's daemon, which paired machines' connections go to.
    daemon_endpoint: PathBuf,
    events: Arc<dyn PairingEvents>,
    /// Held while the endpoint starts or stops: several windows switch it,
    /// and a stop never comes before a start that is still on its way.
    switching: tokio::sync::Mutex<()>,
    endpoint: Mutex<Option<Endpoint>>,
    /// The connections of paired machines passed to the daemon: cut off
    /// when their machine is unpaired or nothing is accepted any more.
    passed: Mutex<Vec<iroh::endpoint::Connection>>,
    open_code: Mutex<Option<OpenCode>>,
    requests: Mutex<HashMap<u64, oneshot::Sender<Option<String>>>>,
    next_request: AtomicU64,
}

impl Pairing {
    pub fn new(
        home: &Path,
        server: Server,
        daemon_endpoint: PathBuf,
        events: Arc<dyn PairingEvents>,
    ) -> Self {
        Self(Arc::new(Inner {
            store: Store::new(home),
            server,
            daemon_endpoint,
            events,
            switching: tokio::sync::Mutex::new(()),
            endpoint: Mutex::new(None),
            passed: Mutex::new(Vec::new()),
            open_code: Mutex::new(None),
            requests: Mutex::new(HashMap::new()),
            next_request: AtomicU64::new(1),
        }))
    }

    /// Starts this machine's endpoint: the Remote feature was switched on.
    pub async fn enable(&self) -> Result<(), PairingError> {
        let _switching = self.0.switching.lock().await;
        if lock(&self.0.endpoint).is_some() {
            return Ok(());
        }
        let key = self.0.store.key()?;
        let endpoint = match self.bind(key.clone(), Some(PAIRING_PORT)).await {
            Ok(endpoint) => endpoint,
            // Taken, by another Cogno build or another program: any port.
            Err(_) => self.bind(key, None).await?,
        };
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

    async fn bind(
        &self,
        key: iroh::SecretKey,
        port: Option<u16>,
    ) -> Result<Endpoint, PairingError> {
        let builder = Endpoint::builder(presets::Minimal)
            .secret_key(key)
            .relay_mode(RelayMode::Custom(self.0.server.relay_map.clone()))
            .address_lookup(
                iroh_mdns_address_lookup::MdnsAddressLookup::builder()
                    .service_name(LOCAL_SERVICE_NAME),
            )
            .alpns(vec![PAIR_ALPN.to_vec(), HOST_ALPN.to_vec()]);
        let builder = match port {
            Some(port) => builder
                .clear_ip_transports()
                .bind_addr((std::net::Ipv4Addr::UNSPECIFIED, port))
                .and_then(|builder| builder.bind_addr((std::net::Ipv6Addr::UNSPECIFIED, port)))
                .map_err(|error| PairingError::Unreachable(error.to_string()))?,
            None => builder,
        };
        #[cfg(test)]
        let builder = if self.0.server.insecure {
            builder.ca_tls_config(iroh::tls::CaTlsConfig::insecure_skip_verify())
        } else {
            builder
        };
        builder
            .bind()
            .await
            .map_err(|error| PairingError::Unreachable(error.to_string()))
    }

    /// Stops the endpoint: the Remote feature was switched off. Nothing is
    /// reachable any more; a code shown is gone, a request is declined.
    pub async fn disable(&self) {
        let _switching = self.0.switching.lock().await;
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
        let addresses = lock(&self.0.endpoint)
            .as_ref()
            .map(|endpoint| {
                endpoint
                    .addr()
                    .ip_addrs()
                    .filter(|address| !address.ip().is_loopback())
                    .map(ToString::to_string)
                    .collect()
            })
            .unwrap_or_default();
        Ok(PairingView {
            accepting: paired.accepting,
            machines: paired.machines,
            addresses,
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
            handshake::CONFIRM_WAIT,
        )
        .await
        .map_err(|error| PairingError::Unreachable(error.to_string()))?;
        match reply {
            Reply::Accepted { name } => {
                let machine = self.0.store.change(|paired| {
                    let name = unique_name(name.as_deref(), taken, paired);
                    let machine = PairedMachine::new(name, peer);
                    paired.machines.retain(|known| known.endpoint_id != peer);
                    paired.machines.push(machine.clone());
                    machine
                })?;
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

    /// Whether paired machines may connect; turned off, the ones connected
    /// are cut off.
    pub fn set_accepting(&self, accepting: bool) -> Result<(), PairingError> {
        self.0.store.change(|paired| paired.accepting = accepting)?;
        if !accepting {
            self.cut_off(|_| true);
        }
        self.0.events.changed();
        Ok(())
    }

    /// Saves the settings of the paired machine `previous` - its name and
    /// how it is reached.
    pub fn save_machine(
        &self,
        previous: &str,
        name: &str,
        direct_only: bool,
        address: Option<String>,
    ) -> Result<(), PairingError> {
        let address = address
            .as_deref()
            .map(str::trim)
            .filter(|address| !address.is_empty())
            .map(str::to_string);
        self.0.store.change(|paired| {
            for machine in paired.machines.iter_mut().filter(|m| m.name == previous) {
                machine.name = name.to_string();
                machine.direct_only = direct_only;
                machine.address = address.clone();
            }
        })?;
        self.0.events.changed();
        Ok(())
    }

    /// Removes the pairing with `name` here, and tells that machine. Whether
    /// it heard: when not, it refuses this one the next time.
    pub async fn remove(&self, name: &str) -> Result<bool, PairingError> {
        let removed = self.0.store.change(|paired| {
            let index = paired.machines.iter().position(|m| m.name == name)?;
            Some(paired.machines.remove(index))
        })?;
        let Some(machine) = removed else {
            return Ok(true);
        };
        self.cut_off(|peer| peer == machine.endpoint_id);
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

    /// Starts connecting to the paired machine `name`.
    pub fn dial(&self, name: &str) -> CommandResult<Dialing> {
        let endpoint = self.endpoint().map_err(|_| {
            CommandError::new(
                AppErrorCode::PairingOff,
                "Pairing is off: switch on the Remote feature",
            )
        })?;
        let paired = self.0.store.paired().map_err(CommandError::internal)?;
        let machine = paired
            .machines
            .iter()
            .find(|machine| machine.name == name)
            .ok_or_else(|| {
                CommandError::new(
                    AppErrorCode::NotPaired,
                    format!("This machine is not paired with {name}"),
                )
            })?;
        let relay = (!machine.direct_only).then(|| self.0.server.relay_url.clone());
        Ok(Dialing::start(
            endpoint,
            machine.endpoint_id,
            relay,
            machine.address.clone(),
            name,
        ))
    }

    fn endpoint(&self) -> Result<Endpoint, PairingError> {
        lock(&self.0.endpoint).clone().ok_or(PairingError::Off)
    }

    /// Answers a connection another machine made.
    async fn answer_connection(&self, connection: iroh::endpoint::Connection) {
        if connection.alpn() == HOST_ALPN {
            return self.pass_to_daemon(connection).await;
        }
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
        let saved = self.0.store.change(|paired| {
            paired.machines.retain(|known| known.endpoint_id != peer);
            paired.machines.push(PairedMachine::new(chosen, peer));
        });
        if saved.is_err() {
            return Reply::Declined;
        }
        self.0.events.changed();
        Reply::Accepted {
            name: cogno_host::identity::machine_name(),
        }
    }

    /// A paired machine connects to this machine's host: its stream goes to
    /// the daemon, as `cogno server --stdio` passes ssh's. Anyone else is
    /// refused before anything reaches the daemon.
    async fn pass_to_daemon(&self, connection: iroh::endpoint::Connection) {
        // Known before the check: unpairing meanwhile cuts it off as well.
        lock(&self.0.passed).push(connection.clone());
        self.serve_daemon(&connection).await;
        let id = connection.stable_id();
        lock(&self.0.passed).retain(|passed| passed.stable_id() != id);
    }

    async fn serve_daemon(&self, connection: &iroh::endpoint::Connection) {
        let peer = connection.remote_id();
        let refusal = match self.0.store.paired() {
            Ok(paired) if !paired.machines.iter().any(|m| m.endpoint_id == peer) => {
                Some(refusal::NOT_PAIRED)
            }
            Ok(paired) if !paired.accepting => Some(refusal::NOT_ACCEPTING),
            Ok(_) => None,
            Err(_) => Some(refusal::NOT_ACCEPTING),
        };
        if let Some(code) = refusal {
            connection.close(code.into(), b"refused");
            return;
        }
        // The daemon first: without one, the other side learns why instead
        // of finding an empty stream.
        let daemon_endpoint = self.0.daemon_endpoint.clone();
        let reached = tokio::task::spawn_blocking(move || {
            cogno_host::daemon::reach_for_bridge(&daemon_endpoint)
        })
        .await;
        let Ok(Ok(daemon)) = reached else {
            connection.close(refusal::NO_DAEMON.into(), b"no daemon");
            return;
        };
        // The host speaks first: this side opens the stream.
        let Ok((send, recv)) = connection.open_bi().await else {
            return;
        };
        let runtime = tokio::runtime::Handle::current();
        let _ = tokio::task::spawn_blocking(move || {
            cogno_host::daemon::bridge_to(
                daemon,
                tokio_util::io::SyncIoBridge::new_with_handle(recv, runtime.clone()),
                tokio_util::io::SyncIoBridge::new_with_handle(send, runtime),
            )
        })
        .await;
        connection.close(0u32.into(), b"done");
    }

    /// The machine `peer` removed the pairing: so does this one.
    fn forget(&self, peer: EndpointId) {
        let forgotten = self.0.store.change(|paired| {
            let before = paired.machines.len();
            paired
                .machines
                .retain(|machine| machine.endpoint_id != peer);
            paired.machines.len() != before
        });
        self.cut_off(|passed| passed == peer);
        if matches!(forgotten, Ok(true)) {
            self.0.events.changed();
        }
    }

    /// Closes the passed connections of the machines `whose` picks.
    fn cut_off(&self, whose: impl Fn(EndpointId) -> bool) {
        for connection in lock(&self.0.passed).iter() {
            if whose(connection.remote_id()) {
                connection.close(refusal::NOT_PAIRED.into(), b"cut off");
            }
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
        relay: Option<Box<dyn std::any::Any + Send>>,
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
            relay: Some(Box::new(relay)),
            _rendezvous: rendezvous,
        }
    }

    fn home() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("cogno-pairing-{}", uuid::Uuid::new_v4().simple()))
    }

    async fn machine(server: &Server) -> (Pairing, Arc<Told>) {
        machine_with_daemon(server, home().join("host.json")).await
    }

    async fn machine_with_daemon(server: &Server, daemon: PathBuf) -> (Pairing, Arc<Told>) {
        let told = Arc::new(Told::default());
        let pairing = Pairing::new(&home(), server.clone(), daemon, told.clone());
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

    /// Office and laptop, paired; office's connections go to `daemon`.
    async fn paired_pair(test: &TestServer, daemon: PathBuf) -> (Pairing, Pairing, String) {
        let (office, office_told) = machine_with_daemon(&test.server, daemon).await;
        let (laptop, _) = machine(&test.server).await;
        office.create_code().await.unwrap();
        answer_when_asked(&office, &office_told, Some("laptop"));
        let paired = laptop.pair_by_code("K7Q4MX", &[], |_| {}).await.unwrap();
        (office, laptop, paired.name)
    }

    /// What dialing `name` from `from` comes to, through to the host's hello.
    async fn dial(
        from: &Pairing,
        name: &str,
    ) -> CommandResult<crate::host_connection::HostConnection> {
        dial_until_lost(from, name, Box::new(|_, _| {})).await
    }

    async fn dial_until_lost(
        from: &Pairing,
        name: &str,
        on_lost: crate::host_connection::OnLost,
    ) -> CommandResult<crate::host_connection::HostConnection> {
        use crate::host_connection::test_support::NoEvents;
        let dialing = from.dial(name)?;
        let name = name.to_string();
        tokio::task::spawn_blocking(move || dialing.introduce(&name, Arc::new(NoEvents), on_lost))
            .await
            .unwrap()
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_paired_machine_reaches_the_daemon_of_the_other() {
        let test = test_server("K7Q4MX").await;
        let daemon = crate::host_connection::test_support::test_daemon();
        let (office, laptop, office_name) = paired_pair(&test, daemon).await;

        let connection = dial(&laptop, &office_name).await.unwrap();

        let shells = tokio::task::spawn_blocking(move || {
            let shells = connection.request(cogno_host::protocol::Request::ListSessions);
            connection.hang_up();
            shells
        })
        .await
        .unwrap();
        assert!(matches!(
            shells,
            Ok(cogno_host::protocol::Response::Sessions { .. })
        ));
        // As the app does on quitting: nothing stays connected.
        laptop.disable().await;
        office.disable().await;
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_connected_machine_is_cut_off_when_nothing_is_accepted_any_more() {
        let test = test_server("K7Q4MX").await;
        let daemon = crate::host_connection::test_support::test_daemon();
        let (office, laptop, office_name) = paired_pair(&test, daemon).await;
        let (lost, gone) = oneshot::channel();
        let _connection = dial_until_lost(
            &laptop,
            &office_name,
            Box::new(move |_, _| {
                let _ = lost.send(());
            }),
        )
        .await
        .unwrap();

        office.set_accepting(false).unwrap();

        tokio::time::timeout(Duration::from_secs(10), gone)
            .await
            .expect("cut off")
            .unwrap();
        laptop.disable().await;
        office.disable().await;
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_unpaired_is_refused() {
        let test = test_server("K7Q4MX").await;
        let daemon = crate::host_connection::test_support::test_daemon();
        let (office, laptop, office_name) = paired_pair(&test, daemon).await;
        // Office forgets laptop without telling it.
        office
            .0
            .store
            .change(|paired| paired.machines.clear())
            .unwrap();

        let refused = dial(&laptop, &office_name).await;

        assert!(refused.err().unwrap().is(AppErrorCode::NotPaired));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_accepts_nothing_now_refuses() {
        let test = test_server("K7Q4MX").await;
        let daemon = crate::host_connection::test_support::test_daemon();
        let (office, laptop, office_name) = paired_pair(&test, daemon).await;
        office.set_accepting(false).unwrap();

        let refused = dial(&laptop, &office_name).await;

        assert!(refused.err().unwrap().is(AppErrorCode::ConnectFailed));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn without_a_daemon_there_cogno_does_not_run_there() {
        let test = test_server("K7Q4MX").await;
        let (_office, laptop, office_name) = paired_pair(&test, home().join("host.json")).await;

        let refused = dial(&laptop, &office_name).await;

        let error = refused.err().unwrap();
        assert!(error.is(AppErrorCode::CognoNotRunning), "{error:?}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_set_to_direct_only_is_reached_without_the_relay() {
        let mut test = test_server("K7Q4MX").await;
        let daemon = crate::host_connection::test_support::test_daemon();
        let (office, laptop, office_name) = paired_pair(&test, daemon).await;
        let office_at = office
            .view()
            .unwrap()
            .addresses
            .into_iter()
            .find(|address| address.starts_with(|c: char| c.is_ascii_digit()))
            .expect("office is reached directly somewhere");
        let port = office_at.rsplit_once(':').unwrap().1;
        laptop
            .save_machine(
                &office_name,
                &office_name,
                true,
                Some(format!("127.0.0.1:{port}")),
            )
            .unwrap();
        // The relay is gone: only the direct way is left.
        test.relay = None;

        let connection = dial(&laptop, &office_name).await.unwrap();

        tokio::task::spawn_blocking(move || connection.hang_up())
            .await
            .unwrap();
        laptop.disable().await;
        office.disable().await;
    }

    #[test]
    fn a_name_that_is_taken_gets_a_number() {
        let paired = Paired {
            accepting: true,
            machines: vec![PairedMachine::new(
                "laptop 2".into(),
                SecretKey::generate().public(),
            )],
        };
        assert_eq!(unique_name(Some("office"), &[], &paired), "office");
        assert_eq!(
            unique_name(Some("laptop"), &["laptop".into()], &paired),
            "laptop 3"
        );
        assert_eq!(unique_name(None, &[], &paired), "machine");
    }
}
