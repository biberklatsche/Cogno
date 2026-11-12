//! How requests, replies and events travel as bytes between a host and
//! whoever talks to it over a stream (a host on another machine, reached
//! through ssh).
//!
//! The host starts with a preamble, so anything a login prints before it can
//! be told apart and skipped. After that both directions are frames: length,
//! kind, body. Messages are JSON; a session's output is binary, because it is
//! most of the traffic.

use std::io::{self, Read, Write};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::protocol::{Event, Reply, Request};

/// Both ends must speak the same version; there is no negotiation.
pub const PROTOCOL_VERSION: u32 = 1;

/// Control characters around the name: no banner prints this by accident.
const PREAMBLE: &[u8] = b"\x02COGNO-HOST\x03";
/// How much a login may print before the preamble.
const MAX_NOISE_BEFORE_PREAMBLE: usize = 64 * 1024;

const KIND_MESSAGE: u8 = 1;
const KIND_PTY_DATA: u8 = 2;
/// Far above any real frame: a length beyond it is a broken stream.
const MAX_FRAME_LEN: usize = 16 * 1024 * 1024;
const STREAM_ID_LEN: usize = 8;

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestEnvelope {
    /// Chosen by the sender; the reply names it.
    pub id: u64,
    pub request: Request,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum HostMessage {
    /// The first message after the preamble.
    Hello {
        protocol: u32,
        /// `std::env::consts::OS` of the host: "windows", "macos", "linux".
        os: String,
    },
    Reply {
        id: u64,
        reply: Reply,
    },
    Event(Event),
}

fn invalid(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

/// One frame in one write: several threads share the stream.
fn write_frame(writer: &mut impl Write, kind: u8, parts: &[&[u8]]) -> io::Result<()> {
    let body_len: usize = parts.iter().map(|part| part.len()).sum();
    let mut frame = Vec::with_capacity(5 + body_len);
    frame.extend_from_slice(&(body_len as u32).to_le_bytes());
    frame.push(kind);
    for part in parts {
        frame.extend_from_slice(part);
    }
    writer.write_all(&frame)?;
    writer.flush()
}

/// The next frame, or `None` when the stream ended between two frames.
fn read_frame(reader: &mut impl Read) -> io::Result<Option<(u8, Vec<u8>)>> {
    let mut header = [0u8; 5];
    let mut filled = 0;
    while filled < header.len() {
        match reader.read(&mut header[filled..]) {
            Ok(0) if filled == 0 => return Ok(None),
            Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
            Ok(n) => filled += n,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            Err(error) => return Err(error),
        }
    }
    let len = u32::from_le_bytes([header[0], header[1], header[2], header[3]]) as usize;
    if len > MAX_FRAME_LEN {
        return Err(invalid(format!("frame of {len} bytes")));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    Ok(Some((header[4], body)))
}

fn write_json(writer: &mut impl Write, message: &impl Serialize) -> io::Result<()> {
    let body = serde_json::to_vec(message).map_err(|error| invalid(error.to_string()))?;
    write_frame(writer, KIND_MESSAGE, &[&body])
}

fn parse_json<T: DeserializeOwned>(body: &[u8]) -> io::Result<T> {
    serde_json::from_slice(body).map_err(|error| invalid(error.to_string()))
}

/// What a host sends first.
pub fn write_hello(writer: &mut impl Write) -> io::Result<()> {
    writer.write_all(PREAMBLE)?;
    write_host_message(
        writer,
        HostMessage::Hello {
            protocol: PROTOCOL_VERSION,
            os: std::env::consts::OS.to_string(),
        },
    )
}

/// Reads up to and including the preamble, past whatever came before it.
pub fn skip_to_preamble(reader: &mut impl Read) -> io::Result<()> {
    let mut matched = 0;
    let mut byte = [0u8; 1];
    for _ in 0..MAX_NOISE_BEFORE_PREAMBLE + PREAMBLE.len() {
        reader.read_exact(&mut byte)?;
        matched = if byte[0] == PREAMBLE[matched] {
            matched + 1
        } else if byte[0] == PREAMBLE[0] {
            1
        } else {
            0
        };
        if matched == PREAMBLE.len() {
            return Ok(());
        }
    }
    Err(invalid("no Cogno host answered"))
}

pub fn write_request(writer: &mut impl Write, envelope: &RequestEnvelope) -> io::Result<()> {
    write_json(writer, envelope)
}

pub fn read_request(reader: &mut impl Read) -> io::Result<Option<RequestEnvelope>> {
    match read_frame(reader)? {
        None => Ok(None),
        Some((KIND_MESSAGE, body)) => parse_json(&body).map(Some),
        Some((kind, _)) => Err(invalid(format!("frame kind {kind} from the client"))),
    }
}

pub fn write_host_message(writer: &mut impl Write, message: HostMessage) -> io::Result<()> {
    match message {
        HostMessage::Event(Event::PtyData { stream, frame }) => {
            write_frame(writer, KIND_PTY_DATA, &[&stream.to_le_bytes(), &frame])
        }
        message => write_json(writer, &message),
    }
}

/// The id of a request nobody waits for (what is typed, resized,
/// acknowledged): the host does not answer it.
pub const NO_REPLY: u64 = 0;

pub fn read_host_message(reader: &mut impl Read) -> io::Result<Option<HostMessage>> {
    match read_frame(reader)? {
        None => Ok(None),
        Some((KIND_MESSAGE, body)) => parse_json(&body).map(Some),
        Some((KIND_PTY_DATA, mut frame)) if frame.len() >= STREAM_ID_LEN => {
            let stream =
                u64::from_le_bytes(frame[..STREAM_ID_LEN].try_into().expect("eight bytes"));
            // In place: the output itself is not copied again.
            frame.drain(..STREAM_ID_LEN);
            Ok(Some(HostMessage::Event(Event::PtyData { stream, frame })))
        }
        Some((kind, _)) => Err(invalid(format!("frame kind {kind} from the host"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Response;

    #[test]
    fn a_request_arrives_as_it_was_sent() {
        let mut bytes = Vec::new();
        write_request(
            &mut bytes,
            &RequestEnvelope {
                id: 7,
                request: Request::PtyResize {
                    terminal_id: "t1".into(),
                    cols: 120,
                    rows: 40,
                },
            },
        )
        .unwrap();

        let mut reader = bytes.as_slice();
        let envelope = read_request(&mut reader).unwrap().unwrap();
        assert_eq!(envelope.id, 7);
        assert!(matches!(
            envelope.request,
            Request::PtyResize { terminal_id, cols: 120, rows: 40 } if terminal_id == "t1"
        ));
        // The stream ended between two frames.
        assert!(read_request(&mut reader).unwrap().is_none());
    }

    #[test]
    fn a_sessions_output_travels_as_bytes_and_everything_else_as_messages() {
        let output: Vec<u8> = (0..=255).collect();
        let mut bytes = Vec::new();
        write_host_message(
            &mut bytes,
            HostMessage::Event(Event::PtyData {
                stream: 3,
                frame: output.clone(),
            }),
        )
        .unwrap();
        write_host_message(
            &mut bytes,
            HostMessage::Reply {
                id: 9,
                reply: Err("Session not found: t1".into()),
            },
        )
        .unwrap();
        write_host_message(
            &mut bytes,
            HostMessage::Reply {
                id: 10,
                reply: Ok(Response::Done),
            },
        )
        .unwrap();
        // The header, the stream id and the bytes themselves: nothing encoded.
        assert_eq!(
            &bytes[5 + STREAM_ID_LEN..5 + STREAM_ID_LEN + 256],
            &output[..]
        );

        let mut reader = bytes.as_slice();
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Event(Event::PtyData { stream: 3, frame })) if frame == output
        ));
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Reply { id: 9, reply: Err(error) }) if error == "Session not found: t1"
        ));
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Reply {
                id: 10,
                reply: Ok(Response::Done)
            })
        ));
    }

    #[test]
    fn the_hello_is_found_behind_what_a_login_printed() {
        let mut bytes = b"Last login: Mon Nov  9\r\n\x02COGNO welcome\r\n".to_vec();
        write_hello(&mut bytes).unwrap();

        let mut reader = bytes.as_slice();
        skip_to_preamble(&mut reader).unwrap();
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Hello { protocol: PROTOCOL_VERSION, os }) if os == std::env::consts::OS
        ));
    }

    #[test]
    fn a_stream_without_a_host_behind_it_is_an_error() {
        let mut reader: &[u8] = b"bash: cogno: command not found\n";
        assert!(skip_to_preamble(&mut reader).is_err());
    }

    #[test]
    fn a_stream_that_ends_inside_a_frame_is_an_error() {
        let mut bytes = Vec::new();
        write_host_message(
            &mut bytes,
            HostMessage::Reply {
                id: 1,
                reply: Ok(Response::Done),
            },
        )
        .unwrap();
        bytes.truncate(bytes.len() - 1);
        assert!(read_host_message(&mut bytes.as_slice()).is_err());
    }
}
