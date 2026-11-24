//! The pairing handshake (`cogno/pair/1`, ARCHITECTURE.md 2.7.3). To pair,
//! one machine asks another; both show the same check number, and each
//! tells the other once its user confirmed it. Only when both did are the
//! two paired. To unpair, either side tells the other. Who talks is proven
//! by the connection: iroh authenticates each side's endpoint id.
//!
//! The check number comes from both ids and a fresh random number of each
//! side. The asker commits to its number before the other one names its
//! own, so neither can pick a number that makes the check come out as it
//! wants: a machine in between, talking to both, shows them different
//! numbers.

use std::future::Future;
use std::io;
use std::time::Duration;

use iroh::endpoint::{Connection, RecvStream, SendStream};
use iroh::{Endpoint, EndpointAddr, EndpointId};
use ring::digest::{digest, SHA256};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};

use super::frame;

pub const PAIR_ALPN: &[u8] = b"cogno/pair/1";

/// How long one step of the handshake may take.
const STEP_PATIENCE: Duration = Duration::from_secs(10);
/// How long the users may take to compare the check number.
pub const CONFIRM_PATIENCE: Duration = Duration::from_secs(120);
/// How long a machine waits for the other one's word: longer than that one
/// waits for its user, so a word given at the last moment arrives.
const CONFIRM_WAIT: Duration = CONFIRM_PATIENCE.saturating_add(STEP_PATIENCE);
/// Digits of the check number.
const CHECK_DIGITS: u32 = 6;
const NONCE_BYTES: usize = 32;

/// What the two machines say to each other.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Message {
    /// Asks to pair. `name` is how the asking machine calls itself;
    /// `commitment` is the hash of its random number.
    Pair {
        name: Option<String>,
        commitment: String,
    },
    /// The asked machine's name and random number.
    Offer { name: Option<String>, nonce: String },
    /// The asking machine's random number, which it committed to.
    Reveal { nonce: String },
    /// This machine's user confirmed the check number.
    Confirmed,
    /// This machine does not pair: nobody pairs there now, or its user
    /// declined.
    Declined,
    /// The asking machine removed the pairing.
    Unpair,
    /// Done what was asked, or heard what was said.
    Done,
    #[serde(other)]
    Unknown,
}

fn broken(what: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, what)
}

fn nonce() -> io::Result<[u8; NONCE_BYTES]> {
    let mut nonce = [0u8; NONCE_BYTES];
    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| io::Error::other("no random number"))?;
    Ok(nonce)
}

fn commitment_to(nonce: &[u8]) -> String {
    hex::encode(digest(&SHA256, nonce))
}

/// The number both machines show: equal only if each talks to the machine
/// the other is, with the random numbers both saw.
fn check_number(
    asking: EndpointId,
    asked: EndpointId,
    asking_nonce: &[u8],
    asked_nonce: &[u8],
) -> String {
    let mut input = Vec::new();
    input.extend_from_slice(PAIR_ALPN);
    input.extend_from_slice(asking.as_bytes());
    input.extend_from_slice(asked.as_bytes());
    input.extend_from_slice(asking_nonce);
    input.extend_from_slice(asked_nonce);
    let hash = digest(&SHA256, &input);
    let value = u32::from_be_bytes(hash.as_ref()[..4].try_into().expect("four bytes"));
    format!(
        "{:0width$}",
        value % 10u32.pow(CHECK_DIGITS),
        width = CHECK_DIGITS as usize
    )
}

/// Whether this machine asked to pair or was asked.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Side {
    Asking,
    Asked,
}

/// A pairing both machines have a check number for, waiting for the users.
pub struct Pending {
    pub peer: EndpointId,
    /// How the other machine calls itself.
    pub peer_name: Option<String>,
    /// The number both machines show.
    pub check: String,
    side: Side,
    connection: Connection,
    send: SendStream,
    recv: RecvStream,
}

/// Asks the machine at `to` to pair, as `name`. `None` when that machine
/// does not pair now.
pub async fn ask_to_pair(
    endpoint: &Endpoint,
    to: impl Into<EndpointAddr>,
    name: Option<String>,
) -> io::Result<Option<Pending>> {
    let (connection, mut send, mut recv) = frame::open(endpoint, to, PAIR_ALPN).await?;
    let own_nonce = nonce()?;
    let asking = Message::Pair {
        name,
        commitment: commitment_to(&own_nonce),
    };
    frame::write(&mut send, &asking).await?;
    let (peer_name, their_nonce) = match frame::read(&mut recv, STEP_PATIENCE).await? {
        Message::Offer { name, nonce } => (
            name,
            hex::decode(nonce).map_err(|_| broken("not a random number"))?,
        ),
        Message::Declined => {
            connection.close(0u32.into(), b"done");
            return Ok(None);
        }
        _ => return Err(broken("no offer")),
    };
    let reveal = Message::Reveal {
        nonce: hex::encode(own_nonce),
    };
    frame::write(&mut send, &reveal).await?;
    let peer = connection.remote_id();
    Ok(Some(Pending {
        peer,
        peer_name,
        check: check_number(endpoint.id(), peer, &own_nonce, &their_nonce),
        side: Side::Asking,
        connection,
        send,
        recv,
    }))
}

/// What another machine asks on a connection that came in on `PAIR_ALPN`.
pub enum Incoming {
    Pair(AskedToPair),
    Unpair(Answering),
}

/// Another machine asks to pair.
pub struct AskedToPair {
    pub peer: EndpointId,
    name: Option<String>,
    commitment: String,
    answering: Answering,
    recv: RecvStream,
}

/// A request to be answered once.
pub struct Answering {
    pub peer: EndpointId,
    connection: Connection,
    send: SendStream,
}

/// The request on a connection that came in on `PAIR_ALPN`; `None` for one
/// this Cogno does not know.
pub async fn receive(connection: Connection) -> io::Result<Option<Incoming>> {
    let (send, mut recv) = tokio::time::timeout(STEP_PATIENCE, connection.accept_bi())
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "no request in time"))?
        .map_err(io::Error::other)?;
    let request = frame::read(&mut recv, STEP_PATIENCE).await?;
    let answering = Answering {
        peer: connection.remote_id(),
        connection,
        send,
    };
    Ok(match request {
        Message::Pair { name, commitment } => Some(Incoming::Pair(AskedToPair {
            peer: answering.peer,
            name,
            commitment,
            answering,
            recv,
        })),
        Message::Unpair => Some(Incoming::Unpair(answering)),
        _ => None,
    })
}

impl Answering {
    /// Says `reply` and waits for the asker to hang up.
    pub async fn reply(mut self, reply: &Message) -> io::Result<()> {
        frame::write(&mut self.send, reply).await?;
        self.send.finish().map_err(io::Error::other)?;
        // The asker hangs up once it has the reply.
        let _ = tokio::time::timeout(STEP_PATIENCE, self.connection.closed()).await;
        Ok(())
    }
}

impl AskedToPair {
    /// This machine does not pair now.
    pub async fn decline(self) -> io::Result<()> {
        self.answering.reply(&Message::Declined).await
    }

    /// Goes on with the pairing, as `name`: both machines get their check
    /// number.
    pub async fn offer(self, endpoint: &Endpoint, name: Option<String>) -> io::Result<Pending> {
        let AskedToPair {
            peer,
            name: peer_name,
            commitment,
            answering:
                Answering {
                    connection,
                    mut send,
                    ..
                },
            mut recv,
        } = self;
        let own_nonce = nonce()?;
        let offer = Message::Offer {
            name,
            nonce: hex::encode(own_nonce),
        };
        frame::write(&mut send, &offer).await?;
        let their_nonce = match frame::read(&mut recv, STEP_PATIENCE).await? {
            Message::Reveal { nonce } => {
                hex::decode(nonce).map_err(|_| broken("not a random number"))?
            }
            _ => return Err(broken("no random number")),
        };
        if commitment_to(&their_nonce) != commitment {
            return Err(broken("not the random number committed to"));
        }
        Ok(Pending {
            peer,
            peer_name,
            check: check_number(peer, endpoint.id(), &their_nonce, &own_nonce),
            side: Side::Asked,
            connection,
            send,
            recv,
        })
    }
}

impl Pending {
    /// Tells the other machine what this machine's user says (`confirmed`,
    /// once it is known) and hears what that one's says. True when both
    /// confirmed. Gives up on this machine's user as soon as the other one
    /// declined or is gone.
    pub async fn settle(self, confirmed: impl Future<Output = bool>) -> bool {
        let Pending {
            side,
            connection,
            mut send,
            mut recv,
            ..
        } = self;
        // In a block of its own: the two let go of the streams after it.
        let both = {
            let saying = async {
                let confirmed = confirmed.await;
                let word = if confirmed {
                    Message::Confirmed
                } else {
                    Message::Declined
                };
                frame::write(&mut send, &word).await.is_ok() && confirmed
            };
            let hearing = async {
                matches!(
                    frame::read(&mut recv, CONFIRM_WAIT).await,
                    Ok(Message::Confirmed)
                )
            };
            tokio::pin!(saying, hearing);
            tokio::select! {
                said = &mut saying => said && hearing.await,
                heard = &mut hearing => heard && saying.await,
            }
        };
        if both {
            // Neither hangs up before the other has heard: the asking
            // machine says that it did, the asked one hangs up after.
            match side {
                Side::Asking => {
                    let _ = frame::write(&mut send, &Message::Done).await;
                    let _ = tokio::time::timeout(STEP_PATIENCE, connection.closed()).await;
                }
                Side::Asked => {
                    let _ = frame::read::<Message>(&mut recv, STEP_PATIENCE).await;
                }
            }
        }
        connection.close(0u32.into(), b"done");
        both
    }
}

/// Tells the machine at `to` that this one removed the pairing. Whether it
/// heard.
pub async fn tell_unpaired(
    endpoint: &Endpoint,
    to: impl Into<EndpointAddr>,
    patience: Duration,
) -> bool {
    let told: io::Result<Message> =
        frame::ask(endpoint, to, PAIR_ALPN, &Message::Unpair, patience).await;
    matches!(told, Ok(Message::Done))
}

#[cfg(test)]
pub(crate) mod test_support {
    use iroh::endpoint::presets;
    use iroh::{Endpoint, RelayMode, SecretKey};

    /// An endpoint on this machine without relay or lookup, taking `alpns`.
    pub async fn endpoint(alpns: &[&[u8]]) -> Endpoint {
        Endpoint::builder(presets::Minimal)
            .secret_key(SecretKey::generate())
            .relay_mode(RelayMode::Disabled)
            .alpns(alpns.iter().map(|alpn| alpn.to_vec()).collect())
            .bind()
            .await
            .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::endpoint;
    use super::*;

    /// The asked machine's side of a pairing, up to the check number.
    async fn offered(asked: Endpoint, name: &'static str) -> Pending {
        let connection = asked.accept().await.unwrap().await.unwrap();
        match receive(connection).await.unwrap() {
            Some(Incoming::Pair(asking)) => {
                asking.offer(&asked, Some(name.to_string())).await.unwrap()
            }
            _ => panic!("not asked to pair"),
        }
    }

    /// Both sides of a pairing with their check number: asking, asked. The
    /// endpoints live as long as the test holds what is returned last.
    async fn pending() -> (Pending, Pending, (Endpoint, Endpoint)) {
        let office = endpoint(&[PAIR_ALPN]).await;
        let laptop = endpoint(&[]).await;
        let asked = tokio::spawn(offered(office.clone(), "office"));
        let asking = ask_to_pair(&laptop, office.addr(), Some("laptop".to_string()))
            .await
            .unwrap()
            .unwrap();
        (asking, asked.await.unwrap(), (office, laptop))
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn both_machines_get_the_same_check_number_and_each_others_name() {
        let (asking, asked, _endpoints) = pending().await;

        assert_eq!(asking.check, asked.check);
        assert_eq!(asking.check.len(), 6);
        assert_eq!(asking.peer_name.as_deref(), Some("office"));
        assert_eq!(asked.peer_name.as_deref(), Some("laptop"));
    }

    #[test]
    fn another_machine_or_another_random_number_gives_another_check_number() {
        let a = iroh::SecretKey::generate().public();
        let b = iroh::SecretKey::generate().public();
        let stranger = iroh::SecretKey::generate().public();

        let between_them = check_number(a, b, b"one", b"two");
        assert_ne!(between_them, check_number(a, stranger, b"one", b"two"));
        assert_ne!(between_them, check_number(a, b, b"one", b"other"));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn two_machines_are_paired_only_when_both_users_confirmed() {
        let (asking, asked, _endpoints) = pending().await;
        let asked = tokio::spawn(asked.settle(async { true }));
        assert!(asking.settle(async { true }).await);
        assert!(asked.await.unwrap());

        let (asking, asked, _endpoints) = pending().await;
        let asked = tokio::spawn(asked.settle(async { false }));
        assert!(!asking.settle(async { true }).await);
        assert!(!asked.await.unwrap());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_user_is_not_waited_for_once_the_other_one_declined() {
        let (asking, asked, _endpoints) = pending().await;
        let asked = tokio::spawn(asked.settle(async { false }));

        // This machine's user never answers.
        let settled = tokio::time::timeout(
            Duration::from_secs(5),
            asking.settle(std::future::pending()),
        )
        .await;

        assert_eq!(settled, Ok(false));
        assert!(!asked.await.unwrap());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_does_not_pair_now_says_so() {
        let office = endpoint(&[PAIR_ALPN]).await;
        let laptop = endpoint(&[]).await;
        let office_addr = office.addr();
        let declining = tokio::spawn(async move {
            let connection = office.accept().await.unwrap().await.unwrap();
            match receive(connection).await.unwrap() {
                Some(Incoming::Pair(asking)) => asking.decline().await.unwrap(),
                _ => panic!("not asked to pair"),
            }
        });

        let asked = ask_to_pair(&laptop, office_addr, None).await.unwrap();

        assert!(asked.is_none());
        declining.await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_random_number_that_was_not_committed_to_ends_the_pairing() {
        let office = endpoint(&[PAIR_ALPN]).await;
        let laptop = endpoint(&[]).await;
        let office_addr = office.addr();
        let asked = tokio::spawn(async move {
            let connection = office.accept().await.unwrap().await.unwrap();
            match receive(connection).await.unwrap() {
                Some(Incoming::Pair(asking)) => asking.offer(&office, None).await,
                _ => panic!("not asked to pair"),
            }
        });

        // Commits to one number and reveals another, chosen after the offer.
        let (_connection, mut send, mut recv) =
            frame::open(&laptop, office_addr, PAIR_ALPN).await.unwrap();
        let asking = Message::Pair {
            name: None,
            commitment: commitment_to(b"committed"),
        };
        frame::write(&mut send, &asking).await.unwrap();
        let _offer: Message = frame::read(&mut recv, STEP_PATIENCE).await.unwrap();
        let reveal = Message::Reveal {
            nonce: hex::encode(b"chosen later"),
        };
        frame::write(&mut send, &reveal).await.unwrap();

        assert!(asked.await.unwrap().is_err());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_hears_that_the_other_one_removed_the_pairing() {
        let office = endpoint(&[PAIR_ALPN]).await;
        let laptop = endpoint(&[]).await;
        let laptop_id = laptop.id();
        let office_addr = office.addr();
        let answering = tokio::spawn(async move {
            let connection = office.accept().await.unwrap().await.unwrap();
            match receive(connection).await.unwrap() {
                Some(Incoming::Unpair(answering)) => {
                    assert_eq!(answering.peer, laptop_id);
                    answering.reply(&Message::Done).await.unwrap();
                }
                _ => panic!("not told of an unpairing"),
            }
        });

        assert!(tell_unpaired(&laptop, office_addr, STEP_PATIENCE).await);
        answering.await.unwrap();
    }

    #[test]
    fn a_message_of_a_later_cogno_is_unknown_not_unreadable() {
        let message: Message = serde_json::from_str(r#"{"type":"rename","to":"x"}"#).unwrap();
        assert_eq!(message, Message::Unknown);
    }
}
