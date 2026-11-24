//! Messages of the pairing protocols on an iroh stream: a length (u32, big
//! endian) and that many bytes of JSON. Small by design - a message that
//! needs more is not one of ours.

use std::io;
use std::time::Duration;

use iroh::endpoint::{Connection, RecvStream, SendStream};
use iroh::{Endpoint, EndpointAddr};
use serde::{de::DeserializeOwned, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// The longest message either side accepts.
const MAX_MESSAGE_BYTES: u32 = 4096;
/// How long reaching the other side may take.
const CONNECT_PATIENCE: Duration = Duration::from_secs(10);

/// Connects to `to` on `alpn` and opens the stream the two talk over.
pub async fn open(
    endpoint: &Endpoint,
    to: impl Into<EndpointAddr>,
    alpn: &[u8],
) -> io::Result<(Connection, SendStream, RecvStream)> {
    // iroh keeps trying to reach a machine that is not there; the asker
    // does not wait that long.
    let connecting = async {
        let connection = endpoint.connect(to, alpn).await.map_err(io::Error::other)?;
        let (send, recv) = connection.open_bi().await.map_err(io::Error::other)?;
        Ok::<_, io::Error>((connection, send, recv))
    };
    tokio::time::timeout(CONNECT_PATIENCE, connecting)
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "the other machine was not reached"))?
}

pub async fn write<T: Serialize>(send: &mut SendStream, message: &T) -> io::Result<()> {
    let json = serde_json::to_vec(message).map_err(io::Error::other)?;
    let length = u32::try_from(json.len())
        .ok()
        .filter(|length| *length <= MAX_MESSAGE_BYTES)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "message too long"))?;
    send.write_all(&length.to_be_bytes()).await?;
    send.write_all(&json).await?;
    send.flush().await
}

/// The next message, if it comes within `patience`.
pub async fn read<T: DeserializeOwned>(recv: &mut RecvStream, patience: Duration) -> io::Result<T> {
    tokio::time::timeout(patience, async {
        let mut length = [0u8; 4];
        AsyncReadExt::read_exact(recv, &mut length).await?;
        let length = u32::from_be_bytes(length);
        if length > MAX_MESSAGE_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "message too long",
            ));
        }
        let mut json = vec![0u8; length as usize];
        AsyncReadExt::read_exact(recv, &mut json).await?;
        serde_json::from_slice(&json)
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
    })
    .await
    .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "no answer in time"))?
}
