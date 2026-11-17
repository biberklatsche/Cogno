//! The pairing handshake (`cogno/pair/1`, ARCHITECTURE.md 2.7.3): one machine
//! asks, the other answers. To pair, B presents the code A showed; A checks it
//! and asks its user, who compares the check number both sides show. To
//! unpair, either side tells the other. Who asks is proven by the connection:
//! iroh authenticates each side's endpoint id.

use std::io;
use std::time::Duration;

use iroh::endpoint::{Connection, SendStream};
use iroh::{Endpoint, EndpointAddr, EndpointId};
use ring::digest::{digest, SHA256};
use serde::{Deserialize, Serialize};

use super::frame;

pub const PAIR_ALPN: &[u8] = b"cogno/pair/1";

/// How long one step of the handshake may take.
const STEP_PATIENCE: Duration = Duration::from_secs(10);
/// How long the user on the other machine may take to allow a pairing.
pub const CONFIRM_PATIENCE: Duration = Duration::from_secs(120);
/// Digits of the check number.
const CHECK_DIGITS: u32 = 6;

/// What one machine asks another.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Request {
    /// Pair, with the code the other machine showed; `name` is how the
    /// asking machine calls itself.
    Pair { code: String, name: Option<String> },
    /// The asking machine removed the pairing.
    Unpair,
    #[serde(other)]
    Unknown,
}

/// The answer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Reply {
    /// Paired; `name` is how the answering machine calls itself.
    Accepted {
        name: Option<String>,
    },
    Declined,
    /// Not the code this machine showed, or no longer.
    WrongCode,
    /// Done what was asked (unpairing).
    Done,
    #[serde(other)]
    Unknown,
}

/// A code as the rendezvous gives it out, from what someone typed: case,
/// dashes and spaces do not matter, and the letters O, I and L, easily
/// mistaken for digits, count as 0, 1 and 1.
pub fn normalize_code(typed: &str) -> String {
    typed
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            other => other,
        })
        .collect()
}

/// The number both machines show while one of them asks its user to allow
/// the pairing: equal only if each talks to the machine the other is.
pub fn check_number(a: EndpointId, b: EndpointId, code: &str) -> String {
    let (first, second) = if a.as_bytes() <= b.as_bytes() {
        (a, b)
    } else {
        (b, a)
    };
    let mut input = Vec::with_capacity(64 + code.len());
    input.extend_from_slice(first.as_bytes());
    input.extend_from_slice(second.as_bytes());
    input.extend_from_slice(normalize_code(code).as_bytes());
    let hash = digest(&SHA256, &input);
    let value = u32::from_be_bytes(hash.as_ref()[..4].try_into().expect("four bytes"));
    format!(
        "{:0width$}",
        value % 10u32.pow(CHECK_DIGITS),
        width = CHECK_DIGITS as usize
    )
}

/// Asks the machine at `to` and waits up to `patience` for its reply.
pub async fn ask(
    endpoint: &Endpoint,
    to: impl Into<EndpointAddr>,
    request: &Request,
    patience: Duration,
) -> io::Result<Reply> {
    frame::ask(endpoint, to, PAIR_ALPN, request, patience).await
}

/// A request another machine made, to be answered once.
pub struct Incoming {
    pub peer: EndpointId,
    pub request: Request,
    connection: Connection,
    send: SendStream,
}

/// The request on a connection that came in on `PAIR_ALPN`.
pub async fn receive(connection: Connection) -> io::Result<Incoming> {
    let (send, mut recv) = tokio::time::timeout(STEP_PATIENCE, connection.accept_bi())
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "no request in time"))?
        .map_err(io::Error::other)?;
    let request = frame::read(&mut recv, STEP_PATIENCE).await?;
    Ok(Incoming {
        peer: connection.remote_id(),
        request,
        connection,
        send,
    })
}

impl Incoming {
    pub async fn reply(mut self, reply: &Reply) -> io::Result<()> {
        frame::write(&mut self.send, reply).await?;
        self.send.finish().map_err(io::Error::other)?;
        // The asker hangs up once it has the reply.
        let _ = tokio::time::timeout(STEP_PATIENCE, self.connection.closed()).await;
        Ok(())
    }
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

    #[test]
    fn a_typed_code_reads_as_given_out() {
        assert_eq!(normalize_code("k7q-4mx"), "K7Q4MX");
        assert_eq!(normalize_code(" O1L I "), "0111");
    }

    #[test]
    fn both_machines_get_the_same_check_number_and_another_machine_another() {
        let a = iroh::SecretKey::generate().public();
        let b = iroh::SecretKey::generate().public();
        let stranger = iroh::SecretKey::generate().public();

        let at_a = check_number(a, b, "K7Q4MX");
        assert_eq!(at_a, check_number(b, a, "k7q-4mx"));
        assert_eq!(at_a.len(), 6);
        assert_ne!(at_a, check_number(a, stranger, "K7Q4MX"));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_request_is_answered_and_the_answerer_knows_who_asked() {
        let a = endpoint(&[PAIR_ALPN]).await;
        let b = endpoint(&[]).await;
        let b_id = b.id();
        let a_addr = a.addr();
        let answering = tokio::spawn(async move {
            let connection = a.accept().await.unwrap().await.unwrap();
            let incoming = receive(connection).await.unwrap();
            assert_eq!(incoming.peer, b_id);
            let reply = match &incoming.request {
                Request::Pair { code, name } if code == "K7Q4MX" => {
                    assert_eq!(name.as_deref(), Some("laptop"));
                    Reply::Accepted {
                        name: Some("office".into()),
                    }
                }
                _ => Reply::WrongCode,
            };
            incoming.reply(&reply).await.unwrap();
        });

        let reply = ask(
            &b,
            a_addr,
            &Request::Pair {
                code: "K7Q4MX".into(),
                name: Some("laptop".into()),
            },
            CONFIRM_PATIENCE,
        )
        .await
        .unwrap();

        assert_eq!(
            reply,
            Reply::Accepted {
                name: Some("office".into())
            }
        );
        answering.await.unwrap();
    }

    #[test]
    fn a_message_of_a_later_cogno_is_unknown_not_unreadable() {
        let request: Request = serde_json::from_str(r#"{"type":"rename","to":"x"}"#).unwrap();
        assert_eq!(request, Request::Unknown);
        let reply: Reply = serde_json::from_str(r#"{"type":"accepted","name":null}"#).unwrap();
        assert_eq!(reply, Reply::Accepted { name: None });
    }
}
