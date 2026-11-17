//! The client of the rendezvous (`cogno/rendezvous/1`, ARCHITECTURE.md
//! 2.7.3): the machine to pair with registers and gets a short code; the
//! other trades the code for its endpoint id. The rendezvous proves who
//! registers the same way the handshake does - by the connection.

use std::io;
use std::time::Duration;

use iroh::{Endpoint, EndpointAddr, EndpointId};
use serde::{Deserialize, Serialize};

use super::frame;

pub const RENDEZVOUS_ALPN: &[u8] = b"cogno/rendezvous/1";

/// How long the rendezvous may take to answer.
const PATIENCE: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Request {
    /// A code for the asking machine; one it had before is gone.
    Register,
    /// The machine that registered `code`; the code is used up.
    Resolve { code: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Reply {
    Registered {
        code: String,
        expires_in_secs: u64,
    },
    Resolved {
        endpoint_id: String,
    },
    /// No such code, or no longer.
    NoSuchCode,
    /// Too many requests, or the rendezvous does not serve this machine.
    Refused {
        reason: String,
    },
    #[serde(other)]
    Unknown,
}

/// A code the rendezvous gave out for this machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Code {
    pub code: String,
    pub expires_in: Duration,
}

/// Why the rendezvous could not help.
#[derive(Debug)]
pub enum Failure {
    /// It was not reached, or did not answer.
    Unreachable(io::Error),
    Refused(String),
    /// There is no such code.
    NoSuchCode,
}

pub async fn register(endpoint: &Endpoint, rendezvous: EndpointAddr) -> Result<Code, Failure> {
    match ask(endpoint, rendezvous, &Request::Register).await? {
        Reply::Registered {
            code,
            expires_in_secs,
        } => Ok(Code {
            code,
            expires_in: Duration::from_secs(expires_in_secs),
        }),
        other => Err(unexpected(other)),
    }
}

pub async fn resolve(
    endpoint: &Endpoint,
    rendezvous: EndpointAddr,
    code: &str,
) -> Result<EndpointId, Failure> {
    let request = Request::Resolve {
        code: code.to_string(),
    };
    match ask(endpoint, rendezvous, &request).await? {
        Reply::Resolved { endpoint_id } => endpoint_id.parse().map_err(|_| {
            Failure::Unreachable(io::Error::new(
                io::ErrorKind::InvalidData,
                "the rendezvous named no valid machine",
            ))
        }),
        Reply::NoSuchCode => Err(Failure::NoSuchCode),
        other => Err(unexpected(other)),
    }
}

async fn ask(
    endpoint: &Endpoint,
    rendezvous: EndpointAddr,
    request: &Request,
) -> Result<Reply, Failure> {
    frame::ask(endpoint, rendezvous, RENDEZVOUS_ALPN, request, PATIENCE)
        .await
        .map_err(Failure::Unreachable)
}

fn unexpected(reply: Reply) -> Failure {
    match reply {
        Reply::Refused { reason } => Failure::Refused(reason),
        _ => Failure::Unreachable(io::Error::new(
            io::ErrorKind::InvalidData,
            "the rendezvous answered something else",
        )),
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    use iroh::{Endpoint, EndpointAddr};

    use super::{Reply, Request, RENDEZVOUS_ALPN};
    use crate::pairing::frame;
    use crate::pairing::handshake::test_support::endpoint;

    /// A rendezvous of the test's own: hands out `code` to whoever registers.
    pub async fn rendezvous(code: &'static str) -> (Endpoint, EndpointAddr) {
        let server = endpoint(&[RENDEZVOUS_ALPN]).await;
        let addr = server.addr();
        serve(server.clone(), code);
        (server, addr)
    }

    /// Answers on `server` as the rendezvous does, handing out `code`.
    pub fn serve(server: Endpoint, code: &'static str) {
        let codes = Arc::new(Mutex::new(HashMap::new()));
        let serving = server;
        tokio::spawn(async move {
            while let Some(incoming) = serving.accept().await {
                let codes = codes.clone();
                tokio::spawn(async move {
                    let connection = incoming.await.unwrap();
                    let (mut send, mut recv) = connection.accept_bi().await.unwrap();
                    let request: Request = frame::read(&mut recv, super::PATIENCE).await.unwrap();
                    let reply = match request {
                        Request::Register => {
                            codes
                                .lock()
                                .unwrap()
                                .insert(code.to_string(), connection.remote_id().to_string());
                            Reply::Registered {
                                code: code.to_string(),
                                expires_in_secs: 300,
                            }
                        }
                        Request::Resolve { code } => match codes.lock().unwrap().remove(&code) {
                            Some(endpoint_id) => Reply::Resolved { endpoint_id },
                            None => Reply::NoSuchCode,
                        },
                    };
                    frame::write(&mut send, &reply).await.unwrap();
                    send.finish().unwrap();
                    connection.closed().await;
                });
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::rendezvous;
    use super::*;
    use crate::pairing::handshake::test_support::endpoint;

    #[tokio::test(flavor = "multi_thread")]
    async fn a_code_leads_to_the_machine_that_registered_it_once() {
        let (_server, at) = rendezvous("K7Q4MX").await;
        let a = endpoint(&[]).await;
        let b = endpoint(&[]).await;

        let code = register(&a, at.clone()).await.unwrap();
        assert_eq!(code.code, "K7Q4MX");

        assert_eq!(resolve(&b, at.clone(), "K7Q4MX").await.unwrap(), a.id());
        assert!(matches!(
            resolve(&b, at, "K7Q4MX").await,
            Err(Failure::NoSuchCode)
        ));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_rendezvous_that_is_not_there_is_unreachable() {
        let b = endpoint(&[]).await;
        let gone = endpoint(&[]).await;
        let at = gone.addr();
        gone.close().await;

        let resolved = tokio::time::timeout(Duration::from_secs(30), resolve(&b, at, "K7Q4MX"))
            .await
            .expect("gives up in time");
        assert!(matches!(resolved, Err(Failure::Unreachable(_))));
    }
}
