//! Pairing with another machine (ARCHITECTURE.md 2.7.3): two machines learn
//! each other once and then connect over iroh, in the local network without
//! any server.
//!
//! `Pairing` runs this machine's endpoint while the Remote feature is on.
//! While the user has pairing open, it announces this machine's name, lists
//! the machines nearby that do the same, asks one of them to pair and
//! answers the requests of others - asking the user on both machines
//! through `PairingEvents`. It unpairs on both sides, accepts the
//! connections of paired machines and hands them to this machine's host,
//! and dials them.

mod dial;
mod frame;
mod handshake;
mod store;

use std::collections::{BTreeMap, HashMap};
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use cogno_host::local_host::LocalHost;
use cogno_host::sync::lock;
use iroh::endpoint::presets;
use iroh::{Endpoint, EndpointAddr, EndpointId, RelayMode};
use iroh_mdns_address_lookup::{DiscoveryEvent, MdnsAddressLookup};
use n0_future::StreamExt;
use tokio::sync::oneshot;

use crate::command_error::{AppErrorCode, CommandError, CommandResult};
pub use dial::Dialing;
use dial::{refusal, HOST_ALPN};
use handshake::{Incoming, Message, Pending, PAIR_ALPN};
pub use store::PairedMachine;
use store::{Paired, Store};

/// How long the other machine may take to tell it removed the pairing too.
const UNPAIR_PATIENCE: Duration = Duration::from_secs(5);
/// The name machines announce themselves under in the local network
/// (`_cogno._udp`; macOS lists it in `NSBonjourServices`).
const LOCAL_SERVICE_NAME: &str = "cogno";
/// What a machine is called that does not say how it calls itself.
const UNNAMED_MACHINE: &str = "machine";

/// What the user sees of pairing; told through `PairingEvents::changed`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingView {
    pub machines: Vec<PairedMachine>,
    /// Whether the user has pairing open: this machine is seen nearby and
    /// takes requests to pair.
    pub open: bool,
    /// The machines nearby that have pairing open too and are not paired
    /// with this one; none unless pairing is open here.
    pub nearby: Vec<NearbyMachine>,
}

/// A machine in the local network that has pairing open.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NearbyMachine {
    /// What `Pairing::pair` takes.
    pub id: String,
    pub name: String,
}

/// A pairing with another machine waits for this machine's user: both show
/// `check`, and the user says whether they are the same.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairRequest {
    pub id: u64,
    /// How the other machine calls itself, when it says.
    pub name: Option<String>,
    /// The number the other machine shows too.
    pub check: String,
}

/// Where pairing tells the app what happened.
pub trait PairingEvents: Send + Sync + 'static {
    /// Another machine asks to pair: `Pairing::answer` with what the user
    /// says.
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
    /// The other machine was not reached.
    Unreachable(String),
    /// The other machine does not pair now, a user declined or did not
    /// answer in time.
    Declined,
    /// The files in Cogno's home could not be read or written.
    Storage(io::Error),
}

impl From<io::Error> for PairingError {
    fn from(error: io::Error) -> Self {
        PairingError::Storage(error)
    }
}

#[derive(Clone)]
pub struct Pairing(Arc<Inner>);

struct Inner {
    store: Store,
    /// This machine's host, which paired machines' connections go to.
    host: Arc<LocalHost>,
    events: Arc<dyn PairingEvents>,
    /// Held while the endpoint starts or stops: several windows switch it,
    /// and a stop never comes before a start that is still on its way.
    switching: tokio::sync::Mutex<()>,
    endpoint: Mutex<Option<Endpoint>>,
    /// The connections of paired machines handed to the host: cut off when
    /// their machine is unpaired.
    passed: Mutex<Vec<iroh::endpoint::Connection>>,
    /// Whether the user has pairing open.
    open: Mutex<bool>,
    /// The machines in the local network that announce a name: they have
    /// pairing open.
    nearby: Mutex<BTreeMap<EndpointId, String>>,
    /// The pairings that wait for this machine's user.
    requests: Mutex<HashMap<u64, oneshot::Sender<bool>>>,
    next_request: AtomicU64,
}

impl Pairing {
    pub fn new(home: &Path, host: Arc<LocalHost>, events: Arc<dyn PairingEvents>) -> Self {
        Self(Arc::new(Inner {
            store: Store::new(home),
            host,
            events,
            switching: tokio::sync::Mutex::new(()),
            endpoint: Mutex::new(None),
            passed: Mutex::new(Vec::new()),
            open: Mutex::new(false),
            nearby: Mutex::new(BTreeMap::new()),
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
        let unreachable =
            |error: &dyn std::fmt::Display| PairingError::Unreachable(error.to_string());
        let endpoint = Endpoint::builder(presets::Minimal)
            .secret_key(self.0.store.key()?)
            .relay_mode(RelayMode::Disabled)
            .alpns(vec![PAIR_ALPN.to_vec(), HOST_ALPN.to_vec()])
            .bind()
            .await
            .map_err(|error| unreachable(&error))?;
        // Announces this machine in the local network and finds the others
        // there: paired machines by their id, machines to pair with by the
        // name they announce.
        let local_network = MdnsAddressLookup::builder()
            .service_name(LOCAL_SERVICE_NAME)
            .build(endpoint.id())
            .map_err(|error| unreachable(&error))?;
        endpoint
            .address_lookup()
            .map_err(|error| unreachable(&error))?
            .add(local_network.clone());
        self.watch_nearby(local_network, endpoint.id());
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

    /// Keeps `nearby` as the local network says, until the endpoint is gone.
    fn watch_nearby(&self, local_network: MdnsAddressLookup, own: EndpointId) {
        let pairing = self.clone();
        tokio::spawn(async move {
            let mut events = local_network.subscribe().await;
            while let Some(event) = events.next().await {
                let changed = match event {
                    DiscoveryEvent::Discovered { endpoint_info, .. } => {
                        let id = endpoint_info.endpoint_id;
                        let name = endpoint_info
                            .data
                            .user_data()
                            .map(|name| name.to_string())
                            .filter(|name| id != own && !name.is_empty());
                        let mut nearby = lock(&pairing.0.nearby);
                        match name {
                            Some(name) => nearby.insert(id, name.clone()) != Some(name),
                            None => nearby.remove(&id).is_some(),
                        }
                    }
                    DiscoveryEvent::Expired { endpoint_id } => {
                        lock(&pairing.0.nearby).remove(&endpoint_id).is_some()
                    }
                    _ => false,
                };
                if changed {
                    pairing.0.events.changed();
                }
            }
        });
    }

    /// Stops the endpoint: the Remote feature was switched off. Nothing is
    /// reachable any more; pairing is closed, a request is declined.
    pub async fn disable(&self) {
        let _switching = self.0.switching.lock().await;
        let endpoint = lock(&self.0.endpoint).take();
        *lock(&self.0.open) = false;
        lock(&self.0.nearby).clear();
        lock(&self.0.requests).clear();
        if let Some(endpoint) = endpoint {
            endpoint.close().await;
        }
        self.0.events.changed();
    }

    pub fn view(&self) -> Result<PairingView, PairingError> {
        let paired = self.0.store.paired()?;
        let open = *lock(&self.0.open);
        let nearby = if open {
            lock(&self.0.nearby)
                .iter()
                .filter(|(id, _)| !paired.machines.iter().any(|m| m.endpoint_id == **id))
                .map(|(id, name)| NearbyMachine {
                    id: id.to_string(),
                    name: name.clone(),
                })
                .collect()
        } else {
            Vec::new()
        };
        Ok(PairingView {
            machines: paired.machines,
            open,
            nearby,
        })
    }

    /// The user opened or closed pairing. While it is open, this machine
    /// announces its name, so it is seen nearby, and takes requests to pair.
    pub fn set_open(&self, open: bool) -> Result<(), PairingError> {
        let endpoint = self.endpoint()?;
        let name = open.then(own_name).and_then(|name| name.parse().ok());
        endpoint.set_user_data_for_address_lookup(name);
        *lock(&self.0.open) = open;
        if !open {
            // Whoever waits for the user here waits no longer.
            lock(&self.0.requests).clear();
        }
        self.0.events.changed();
        Ok(())
    }

    /// Asks the machine nearby with `id` to pair. `on_request` gets the
    /// check number to show; `answer` says whether this machine's user
    /// found it the same as on the other machine. Paired once both did.
    pub async fn pair(
        &self,
        id: &str,
        on_request: impl FnOnce(PairRequest),
    ) -> Result<PairedMachine, PairingError> {
        let id: EndpointId = id
            .parse()
            .map_err(|_| PairingError::Unreachable("not a machine's id".to_string()))?;
        self.pair_at(EndpointAddr::new(id), on_request).await
    }

    async fn pair_at(
        &self,
        to: EndpointAddr,
        on_request: impl FnOnce(PairRequest),
    ) -> Result<PairedMachine, PairingError> {
        let endpoint = self.endpoint()?;
        let pending = handshake::ask_to_pair(&endpoint, to, Some(own_name()))
            .await
            .map_err(|error| PairingError::Unreachable(error.to_string()))?
            .ok_or(PairingError::Declined)?;
        self.settle(pending, on_request)
            .await
            .ok_or(PairingError::Declined)
    }

    /// Asks this machine's user and tells the other machine; saves the
    /// machine once both users confirmed.
    async fn settle(
        &self,
        pending: Pending,
        tell: impl FnOnce(PairRequest),
    ) -> Option<PairedMachine> {
        let id = self.0.next_request.fetch_add(1, Ordering::Relaxed);
        let (answer, answered) = oneshot::channel();
        lock(&self.0.requests).insert(id, answer);
        let peer = pending.peer;
        let wanted = pending.peer_name.clone();
        tell(PairRequest {
            id,
            name: wanted.clone(),
            check: pending.check.clone(),
        });
        let confirmed = async {
            let answered = tokio::time::timeout(handshake::CONFIRM_PATIENCE, answered).await;
            matches!(answered, Ok(Ok(true)))
        };
        let both = pending.settle(confirmed).await;
        lock(&self.0.requests).remove(&id);
        self.0.events.request_ended(id);
        if !both {
            return None;
        }
        let machine = self
            .0
            .store
            .change(|paired| {
                paired.machines.retain(|known| known.endpoint_id != peer);
                let machine = PairedMachine {
                    name: unique_name(wanted.as_deref(), paired),
                    endpoint_id: peer,
                };
                paired.machines.push(machine.clone());
                machine
            })
            .ok()?;
        self.0.events.changed();
        Some(machine)
    }

    /// What this machine's user says to request `id`: whether the check
    /// number is the same on both machines.
    pub fn answer(&self, id: u64, confirmed: bool) {
        if let Some(answer) = lock(&self.0.requests).remove(&id) {
            let _ = answer.send(confirmed);
        }
    }

    /// Calls the paired machine `previous` `name` from now on.
    pub fn rename(&self, previous: &str, name: &str) -> Result<(), PairingError> {
        self.0.store.change(|paired| {
            for machine in paired.machines.iter_mut().filter(|m| m.name == previous) {
                machine.name = name.to_string();
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
        self.cut_off(machine.endpoint_id);
        self.0.events.changed();
        let Ok(endpoint) = self.endpoint() else {
            return Ok(false);
        };
        Ok(handshake::tell_unpaired(&endpoint, machine.endpoint_id, UNPAIR_PATIENCE).await)
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
        Ok(Dialing::start(endpoint, machine.endpoint_id, name))
    }

    fn endpoint(&self) -> Result<Endpoint, PairingError> {
        lock(&self.0.endpoint).clone().ok_or(PairingError::Off)
    }

    /// Answers a connection another machine made.
    async fn answer_connection(&self, connection: iroh::endpoint::Connection) {
        if connection.alpn() == HOST_ALPN {
            return self.hand_to_host(connection).await;
        }
        match handshake::receive(connection).await {
            Ok(Some(Incoming::Pair(asking))) => {
                let (Ok(endpoint), true) = (self.endpoint(), *lock(&self.0.open)) else {
                    let _ = asking.decline().await;
                    return;
                };
                if let Ok(pending) = asking.offer(&endpoint, Some(own_name())).await {
                    self.settle(pending, |request| self.0.events.request(request))
                        .await;
                }
            }
            Ok(Some(Incoming::Unpair(answering))) => {
                self.forget(answering.peer);
                let _ = answering.reply(&Message::Done).await;
            }
            Ok(None) | Err(_) => {}
        }
    }

    /// A paired machine connects to this machine's host: its stream goes to
    /// the host, which serves it as a Cogno on another machine. Anyone else
    /// is refused before anything reaches the host.
    async fn hand_to_host(&self, connection: iroh::endpoint::Connection) {
        // Known before the check: unpairing meanwhile cuts it off as well.
        lock(&self.0.passed).push(connection.clone());
        self.serve(&connection).await;
        let id = connection.stable_id();
        lock(&self.0.passed).retain(|passed| passed.stable_id() != id);
    }

    async fn serve(&self, connection: &iroh::endpoint::Connection) {
        let peer = connection.remote_id();
        let paired = self
            .0
            .store
            .paired()
            .is_ok_and(|paired| paired.machines.iter().any(|m| m.endpoint_id == peer));
        if !paired {
            connection.close(refusal::NOT_PAIRED.into(), b"refused");
            return;
        }
        // The host speaks first: this side opens the stream.
        let Ok((send, recv)) = connection.open_bi().await else {
            return;
        };
        let runtime = tokio::runtime::Handle::current();
        let host = self.0.host.clone();
        let _ = tokio::task::spawn_blocking(move || {
            host.serve_other_machine(
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
        self.cut_off(peer);
        if matches!(forgotten, Ok(true)) {
            self.0.events.changed();
        }
    }

    /// Closes the connections of the machine `peer` that the host serves.
    fn cut_off(&self, peer: EndpointId) {
        for connection in lock(&self.0.passed).iter() {
            if connection.remote_id() == peer {
                connection.close(refusal::NOT_PAIRED.into(), b"cut off");
            }
        }
    }
}

/// How this machine calls itself towards others.
fn own_name() -> String {
    cogno_host::identity::machine_name().unwrap_or_else(|| UNNAMED_MACHINE.to_string())
}

/// `wanted`, or - when that is taken or missing - the first of "wanted 2",
/// "wanted 3", ... that no paired machine has.
fn unique_name(wanted: Option<&str>, paired: &Paired) -> String {
    let base = wanted
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(UNNAMED_MACHINE);
    let is_free = |name: &str| !paired.machines.iter().any(|m| m.name == name);
    if is_free(base) {
        return base.to_string();
    }
    (2..)
        .map(|n| format!("{base} {n}"))
        .find(|name| is_free(name))
        .expect("a free name")
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

    fn home() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("cogno-pairing-{}", uuid::Uuid::new_v4().simple()))
    }

    /// A machine with the Remote feature on.
    async fn machine() -> (Pairing, Arc<Told>) {
        let told = Arc::new(Told::default());
        let (_, host) = crate::host_connection::test_support::test_host();
        let pairing = Pairing::new(&home(), host, told.clone());
        pairing.enable().await.unwrap();
        (pairing, told)
    }

    /// Where the tests reach `pairing`: its addresses on this machine.
    fn address_of(pairing: &Pairing) -> EndpointAddr {
        pairing.endpoint().unwrap().addr()
    }

    /// Answers the first request `told` hears with `confirmed`.
    fn answer_when_asked(pairing: &Pairing, told: &Arc<Told>, confirmed: bool) {
        let pairing = pairing.clone();
        let told = told.clone();
        tokio::spawn(async move {
            loop {
                if let Some(request) = lock(&told.requests).first().cloned() {
                    pairing.answer(request.id, confirmed);
                    return;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        });
    }

    /// The laptop asks the office to pair and confirms the check number
    /// itself; the office's user says `office_confirms`.
    async fn asked_to_pair(
        office: &Pairing,
        office_told: &Arc<Told>,
        laptop: &Pairing,
        office_confirms: bool,
    ) -> Result<PairedMachine, PairingError> {
        office.set_open(true).unwrap();
        answer_when_asked(office, office_told, office_confirms);
        let asking = laptop.clone();
        laptop
            .pair_at(address_of(office), move |request| {
                asking.answer(request.id, true)
            })
            .await
    }

    /// Office and laptop, paired; the name the laptop knows the office by.
    async fn paired_pair() -> (Pairing, Pairing, String) {
        let (office, office_told) = machine().await;
        let (laptop, _) = machine().await;
        let paired = asked_to_pair(&office, &office_told, &laptop, true)
            .await
            .unwrap();
        (office, laptop, paired.name)
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn two_machines_pair_when_both_users_confirm_the_same_number() {
        let (office, office_told) = machine().await;
        let (laptop, _) = machine().await;
        office.set_open(true).unwrap();
        answer_when_asked(&office, &office_told, true);
        let shown = Arc::new(Mutex::new(None));

        let asking = laptop.clone();
        let seen = shown.clone();
        let paired = laptop
            .pair_at(address_of(&office), move |request| {
                *lock(&seen) = Some(request.check.clone());
                asking.answer(request.id, true);
            })
            .await
            .unwrap();

        let office_request = lock(&office_told.requests)[0].clone();
        assert_eq!(lock(&shown).as_deref(), Some(office_request.check.as_str()));
        assert_eq!(paired.endpoint_id, office.endpoint().unwrap().id());
        // Each knows the other from now on.
        let known_at_the_office = office.view().unwrap().machines;
        assert_eq!(known_at_the_office.len(), 1);
        assert_eq!(
            known_at_the_office[0].endpoint_id,
            laptop.endpoint().unwrap().id()
        );
        assert_eq!(laptop.view().unwrap().machines, [paired]);
        assert_eq!(*lock(&office_told.ended), [office_request.id]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_has_pairing_closed_takes_no_request() {
        let (office, office_told) = machine().await;
        let (laptop, _) = machine().await;

        let refused = laptop.pair_at(address_of(&office), |_| {}).await;

        assert!(matches!(refused, Err(PairingError::Declined)));
        assert!(lock(&office_told.requests).is_empty());
        assert!(laptop.view().unwrap().machines.is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn nothing_is_paired_when_a_user_declines() {
        let (office, office_told) = machine().await;
        let (laptop, _) = machine().await;

        let declined = asked_to_pair(&office, &office_told, &laptop, false).await;

        assert!(matches!(declined, Err(PairingError::Declined)));
        assert!(office.view().unwrap().machines.is_empty());
        assert!(laptop.view().unwrap().machines.is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn closing_pairing_gives_up_on_a_request_that_waits_for_the_user() {
        let (office, office_told) = machine().await;
        let (laptop, _) = machine().await;
        office.set_open(true).unwrap();
        let closing = office.clone();
        let told = office_told.clone();
        tokio::spawn(async move {
            while lock(&told.requests).is_empty() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            closing.set_open(false).unwrap();
        });

        let asking = laptop.clone();
        let given_up = laptop
            .pair_at(address_of(&office), move |request| {
                asking.answer(request.id, true)
            })
            .await;

        assert!(matches!(given_up, Err(PairingError::Declined)));
        assert!(office.view().unwrap().machines.is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_paired_machine_reaches_the_host_of_the_other() {
        let (office, laptop, office_name) = paired_pair().await;

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

    /// What dialing `name` from `from` comes to, through to the host's hello.
    async fn dial(
        from: &Pairing,
        name: &str,
    ) -> CommandResult<crate::host_connection::HostConnection> {
        use crate::host_connection::test_support::NoEvents;
        let dialing = from.dial(name)?;
        let name = name.to_string();
        tokio::task::spawn_blocking(move || {
            dialing.introduce(&name, Arc::new(NoEvents), Box::new(|_, _| {}))
        })
        .await
        .unwrap()
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_is_not_paired_is_refused_by_the_host() {
        let (office, _) = machine().await;
        let (stranger, _) = machine().await;
        // The stranger believes it is paired with the office.
        stranger
            .0
            .store
            .change(|paired| {
                paired.machines.push(PairedMachine {
                    name: "office".into(),
                    endpoint_id: office.endpoint().unwrap().id(),
                })
            })
            .unwrap();
        // It knows where the office is, as from an earlier connection.
        let known = address_of(&office);
        let _ =
            handshake::tell_unpaired(&stranger.endpoint().unwrap(), known, UNPAIR_PATIENCE).await;

        let refused = dial(&stranger, "office").await;

        assert!(refused.err().unwrap().is(AppErrorCode::NotPaired));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn unpairing_removes_the_pairing_on_both_machines() {
        let (office, laptop, office_name) = paired_pair().await;

        let heard = laptop.remove(&office_name).await.unwrap();

        assert!(heard);
        assert!(laptop.view().unwrap().machines.is_empty());
        assert!(office.view().unwrap().machines.is_empty());
        let refused = dial(&laptop, &office_name).await;
        assert!(refused.err().unwrap().is(AppErrorCode::NotPaired));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_paired_machine_is_called_what_the_user_says() {
        let (_office, laptop, office_name) = paired_pair().await;

        laptop.rename(&office_name, "work").unwrap();

        let names: Vec<_> = laptop
            .view()
            .unwrap()
            .machines
            .into_iter()
            .map(|machine| machine.name)
            .collect();
        assert_eq!(names, ["work"]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_is_seen_nearby_only_while_both_have_pairing_open() {
        let (office, _) = machine().await;
        let (laptop, _) = machine().await;
        let office_id = office.endpoint().unwrap().id().to_string();
        let sees_the_office = || {
            laptop
                .view()
                .unwrap()
                .nearby
                .iter()
                .any(|nearby| nearby.id == office_id)
        };
        laptop.set_open(true).unwrap();
        // The office is there, but has pairing closed.
        tokio::time::sleep(Duration::from_secs(2)).await;
        assert!(!sees_the_office());

        office.set_open(true).unwrap();
        let started = std::time::Instant::now();
        while !sees_the_office() {
            assert!(
                started.elapsed() < Duration::from_secs(20),
                "the office was never seen nearby"
            );
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        // Closed here, nothing is listed.
        laptop.set_open(false).unwrap();
        assert!(laptop.view().unwrap().nearby.is_empty());
    }

    #[test]
    fn a_machine_gets_a_name_no_other_paired_machine_has() {
        let paired = Paired {
            machines: vec![PairedMachine {
                name: "laptop".into(),
                endpoint_id: SecretKey::generate().public(),
            }],
        };

        assert_eq!(unique_name(Some("office"), &paired), "office");
        assert_eq!(unique_name(Some("laptop"), &paired), "laptop 2");
        assert_eq!(unique_name(None, &paired), "machine");
        assert_eq!(unique_name(Some("  "), &paired), "machine");
    }
}
