//! How requests, replies and events travel as bytes between a host and
//! whoever talks to it over a stream (this machine's app over loopback, a
//! Cogno on a paired machine).
//!
//! The host starts with a preamble, by which it is told from anything else
//! that may answer, then says hello. The client answers with its own hello. After that both directions are frames: length, kind, body. Messages
//! are JSON; a session's output is binary, because it is most of the traffic.
//! A frame of a kind this build does not know is skipped. A message whose
//! body names something this build does not know fails alone: a request is
//! answered as such, a reply arrives as a failure, anything else is skipped.
//! Only a stream that is not frames of JSON any more ends the connection.

use std::io::{self, Read, Write};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::protocol::{Event, HostError, HostErrorCode, Reply, Request, StreamId};

/// The newest version of this protocol this build speaks.
///
/// Laptop and office machine are never updated at once, so both ends speak a
/// range of versions, from `OLDEST_PROTOCOL_VERSION` up to this one. Both say
/// their range in their hello; they talk when the ranges meet
/// (`check_versions`), in the newest version both speak.
/// A later version adds to the protocol and uses what it adds only where the
/// other end speaks it too; it raises `OLDEST_PROTOCOL_VERSION` only where it
/// gives up what older ones need.
pub const PROTOCOL_VERSION: u32 = 1;
/// The oldest version this build still speaks.
pub const OLDEST_PROTOCOL_VERSION: u32 = 1;

/// Control characters around the name: no banner prints this by accident.
/// It comes before any version is spoken and never changes: a Cogno of any
/// version tells a host by it (`local_host`).
pub(crate) const PREAMBLE: &[u8] = b"\x02COGNO-HOST\x03";

/// Length (u32, little endian), then kind.
const FRAME_HEADER_LEN: usize = 4 + 1;
const KIND_MESSAGE: u8 = 1;
const KIND_OUTPUT: u8 = 2;
/// Far above any real frame: a length beyond it is a broken stream.
const MAX_FRAME_LEN: usize = 16 * 1024 * 1024;
/// An output frame's body: stream id (u64), sequence number (u32), bytes.
const STREAM_ID_LEN: usize = 8;
const SEQ_LEN: usize = 4;

/// What a host says first: the versions it speaks and the system it runs on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostHello {
    /// The newest version the host speaks.
    pub protocol: u32,
    /// The oldest version the host still speaks.
    pub oldest: u32,
    /// `std::env::consts::OS` of the host: "windows", "macos", "linux".
    pub os: String,
}

/// What a client answers the host's hello with.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClientHello {
    /// The newest version the client speaks.
    pub protocol: u32,
    /// The oldest version the client still speaks.
    pub oldest: u32,
    /// What the client is called: the machine its Cogno runs on. Shown to a
    /// client whose session this one takes over.
    pub name: Option<String>,
}

impl ClientHello {
    /// The hello of a client of this build.
    pub fn of_this_build(name: Option<String>) -> Self {
        Self {
            protocol: PROTOCOL_VERSION,
            oldest: OLDEST_PROTOCOL_VERSION,
            name,
        }
    }
}

/// A piece of a session's output: what one read of its PTY gave.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Output {
    pub stream: StreamId,
    /// Counts the pieces of one stream; the client acknowledges by it.
    pub seq: u32,
    pub bytes: Vec<u8>,
}

/// What comes from the host.
#[derive(Debug)]
pub enum HostMessage {
    Hello(HostHello),
    Reply { id: u64, reply: Reply },
    Event(Event),
    Output(Output),
}

/// What goes to the host after the hello.
#[derive(Debug)]
pub enum ClientMessage {
    /// Answered with a `Reply` under `id`, chosen by the client.
    Request { id: u64, request: Request },
    /// Not answered: for what is typed, resized and acknowledged, where the
    /// round trip would only add delay. A failure is the host's to log.
    Post { request: Request },
}

/// What the host reads from a client.
// One at a time and taken apart at once: boxing every message - every key
// typed - would cost an allocation for nothing.
#[allow(clippy::large_enum_variant)]
#[derive(Debug)]
pub enum ClientFrame {
    Message(ClientMessage),
    /// A message whose body names something this build does not know: a
    /// later client's. `id` is the request's, for the host to answer; `None`
    /// for a post, which nobody waits for.
    Unreadable {
        id: Option<u64>,
        reason: String,
    },
}

/// What every JSON frame has, whatever else it holds: enough to answer a
/// message that cannot be read in full.
#[derive(Deserialize)]
struct Envelope {
    #[serde(rename = "type")]
    kind: String,
    id: Option<u64>,
}

/// The kinds of `ClientJson` and `HostJson` that are answered by id.
const REQUEST_KIND: &str = "request";
const REPLY_KIND: &str = "reply";

/// The JSON frames of each direction; output travels in frames of its own.
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum HostJson {
    Hello(HostHello),
    Reply {
        id: u64,
        reply: Reply,
    },
    Event {
        event: Event,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ClientJson {
    Hello(ClientHello),
    Request {
        id: u64,
        request: Request,
    },
    Post {
        request: Request,
    },
    #[serde(other)]
    Unknown,
}

/// Why two ends have no version in common: which of them has to be updated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VersionMismatch {
    /// The other end only speaks versions newer than this build knows.
    ThisIsOlder,
    /// This build no longer speaks the versions the other end knows.
    TheyAreOlder,
}

/// Whether this build and an end that speaks `their_oldest` up to
/// `their_newest` have a version in common.
pub fn check_versions(their_newest: u32, their_oldest: u32) -> Result<(), VersionMismatch> {
    if their_oldest > PROTOCOL_VERSION {
        Err(VersionMismatch::ThisIsOlder)
    } else if their_newest < OLDEST_PROTOCOL_VERSION {
        Err(VersionMismatch::TheyAreOlder)
    } else {
        Ok(())
    }
}

fn invalid(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

/// One frame in one write: several threads may share the stream.
fn write_frame(writer: &mut impl Write, kind: u8, parts: &[&[u8]]) -> io::Result<()> {
    let body_len: usize = parts.iter().map(|part| part.len()).sum();
    if body_len > MAX_FRAME_LEN {
        return Err(invalid(format!("a frame of {body_len} bytes")));
    }
    let mut frame = Vec::with_capacity(FRAME_HEADER_LEN + body_len);
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
    let mut header = [0u8; FRAME_HEADER_LEN];
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
        return Err(invalid(format!("a frame of {len} bytes")));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    Ok(Some((header[FRAME_HEADER_LEN - 1], body)))
}

fn write_json(writer: &mut impl Write, message: &impl Serialize) -> io::Result<()> {
    let body = serde_json::to_vec(message).map_err(|error| invalid(error.to_string()))?;
    write_frame(writer, KIND_MESSAGE, &[&body])
}

fn parse_json<T: DeserializeOwned>(body: &[u8]) -> io::Result<T> {
    serde_json::from_slice(body).map_err(|error| invalid(error.to_string()))
}

/// The body of the next JSON frame, past frames of kinds this build does not
/// know. `None` when the stream ended.
fn read_message_body(reader: &mut impl Read) -> io::Result<Option<Vec<u8>>> {
    loop {
        match read_frame(reader)? {
            None => return Ok(None),
            Some((KIND_MESSAGE, body)) => return Ok(Some(body)),
            Some(_) => continue,
        }
    }
}

/// The next JSON frame. `None` when the stream ended.
fn read_json<T: DeserializeOwned>(reader: &mut impl Read) -> io::Result<Option<T>> {
    read_message_body(reader)?
        .map(|body| parse_json(&body))
        .transpose()
}

/// The envelope of a message that did not decode in full. A body without
/// one is no message at all: the stream is broken.
fn envelope_of(body: &[u8]) -> io::Result<Envelope> {
    parse_json(body)
}

/// What a host sends first.
pub fn write_host_hello(writer: &mut impl Write) -> io::Result<()> {
    writer.write_all(PREAMBLE)?;
    write_json(
        writer,
        &HostJson::Hello(HostHello {
            protocol: PROTOCOL_VERSION,
            oldest: OLDEST_PROTOCOL_VERSION,
            os: std::env::consts::OS.to_string(),
        }),
    )
}

/// Reads the preamble a host's stream begins with.
fn read_preamble(reader: &mut impl Read) -> io::Result<()> {
    let mut begun = [0u8; PREAMBLE.len()];
    reader.read_exact(&mut begun)?;
    if begun == PREAMBLE {
        Ok(())
    } else {
        Err(invalid("no Cogno host answered"))
    }
}

/// The host's hello, the first message after the preamble.
fn read_host_hello(reader: &mut impl Read) -> io::Result<HostHello> {
    match read_json(reader)? {
        Some(HostJson::Hello(hello)) => Ok(hello),
        _ => Err(invalid("the host did not say hello")),
    }
}

pub fn write_client_hello(writer: &mut impl Write, hello: &ClientHello) -> io::Result<()> {
    write_json(writer, &ClientJson::Hello(hello.clone()))
}

/// Why a client and a host did not get to talk.
#[derive(Debug)]
pub enum IntroductionError {
    /// What answered sent no preamble: no Cogno host is there.
    NoHost(io::Error),
    /// The host sent its preamble but no hello.
    NoHello(io::Error),
    /// The two have no version in common.
    Versions(VersionMismatch),
    /// The client's hello could not be written.
    Broken(io::Error),
}

impl std::fmt::Display for IntroductionError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntroductionError::NoHost(error) => {
                write!(formatter, "no Cogno host answered: {error}")
            }
            IntroductionError::NoHello(error) => {
                write!(formatter, "the Cogno host did not say hello: {error}")
            }
            IntroductionError::Versions(_) => {
                formatter.write_str("the Cogno host speaks no protocol version this Cogno does")
            }
            IntroductionError::Broken(error) => {
                write!(formatter, "the hello could not be sent: {error}")
            }
        }
    }
}

impl From<IntroductionError> for io::Error {
    fn from(error: IntroductionError) -> Self {
        match error {
            IntroductionError::NoHost(error)
            | IntroductionError::NoHello(error)
            | IntroductionError::Broken(error) => error,
            IntroductionError::Versions(_) => {
                io::Error::new(io::ErrorKind::Unsupported, error.to_string())
            }
        }
    }
}

/// The hello of the host at the other end: reads its preamble, takes its
/// hello and checks that the two share a version.
fn read_compatible_hello(reader: &mut impl Read) -> Result<HostHello, IntroductionError> {
    read_preamble(reader).map_err(IntroductionError::NoHost)?;
    let host = read_host_hello(reader).map_err(IntroductionError::NoHello)?;
    check_versions(host.protocol, host.oldest).map_err(IntroductionError::Versions)?;
    Ok(host)
}

/// What a client does first: takes the host's hello (`read_compatible_hello`)
/// and says its own `hello`. The host's hello comes back.
pub fn introduce(
    reader: &mut impl Read,
    writer: &mut impl Write,
    hello: &ClientHello,
) -> Result<HostHello, IntroductionError> {
    let host = read_compatible_hello(reader)?;
    write_client_hello(writer, hello).map_err(IntroductionError::Broken)?;
    Ok(host)
}

/// The client's hello, the first message it sends.
pub fn read_client_hello(reader: &mut impl Read) -> io::Result<ClientHello> {
    match read_json(reader)? {
        Some(ClientJson::Hello(hello)) => Ok(hello),
        _ => Err(invalid("the client did not say hello")),
    }
}

pub fn write_client_message(writer: &mut impl Write, message: ClientMessage) -> io::Result<()> {
    let json = match message {
        ClientMessage::Request { id, request } => ClientJson::Request { id, request },
        ClientMessage::Post { request } => ClientJson::Post { request },
    };
    write_json(writer, &json)
}

/// The next message of the client, `None` when it hung up. Messages of kinds
/// this build does not know are skipped; one whose body it cannot read comes
/// as `Unreadable`.
pub fn read_client_message(reader: &mut impl Read) -> io::Result<Option<ClientFrame>> {
    loop {
        let Some(body) = read_message_body(reader)? else {
            return Ok(None);
        };
        let message = match serde_json::from_slice(&body) {
            Ok(ClientJson::Request { id, request }) => ClientMessage::Request { id, request },
            Ok(ClientJson::Post { request }) => ClientMessage::Post { request },
            Ok(ClientJson::Hello(_) | ClientJson::Unknown) => continue,
            Err(error) => {
                let envelope = envelope_of(&body)?;
                return Ok(Some(ClientFrame::Unreadable {
                    id: envelope.id.filter(|_| envelope.kind == REQUEST_KIND),
                    reason: error.to_string(),
                }));
            }
        };
        return Ok(Some(ClientFrame::Message(message)));
    }
}

pub fn write_host_message(writer: &mut impl Write, message: HostMessage) -> io::Result<()> {
    match message {
        HostMessage::Output(Output { stream, seq, bytes }) => write_frame(
            writer,
            KIND_OUTPUT,
            &[&stream.0.to_le_bytes(), &seq.to_le_bytes(), &bytes],
        ),
        HostMessage::Hello(hello) => write_json(writer, &HostJson::Hello(hello)),
        HostMessage::Reply { id, reply } => write_json(writer, &HostJson::Reply { id, reply }),
        HostMessage::Event(event) => write_json(writer, &HostJson::Event { event }),
    }
}

/// The next message of the host, `None` when it hung up. Messages of kinds
/// this build does not know are skipped. A reply whose body it cannot read
/// arrives as a failure of its request; an event it cannot read is skipped.
pub fn read_host_message(reader: &mut impl Read) -> io::Result<Option<HostMessage>> {
    loop {
        let message = match read_frame(reader)? {
            None => return Ok(None),
            Some((KIND_MESSAGE, body)) => match serde_json::from_slice(&body) {
                Ok(HostJson::Hello(hello)) => HostMessage::Hello(hello),
                Ok(HostJson::Reply { id, reply }) => HostMessage::Reply { id, reply },
                Ok(HostJson::Event { event }) => HostMessage::Event(event),
                Ok(HostJson::Unknown) => continue,
                Err(error) => match envelope_of(&body)? {
                    Envelope { kind, id: Some(id) } if kind == REPLY_KIND => HostMessage::Reply {
                        id,
                        reply: Err(HostError::new(
                            // Whatever it says is of a later version.
                            HostErrorCode::Unknown,
                            format!("The host's answer could not be read: {error}"),
                        )),
                    },
                    Envelope { kind, .. } => {
                        log::warn!(target: "host", "skipped a {kind} that could not be read: {error}");
                        continue;
                    }
                },
            },
            Some((KIND_OUTPUT, body)) => HostMessage::Output(parse_output(body)?),
            Some(_) => continue,
        };
        return Ok(Some(message));
    }
}

fn parse_output(mut body: Vec<u8>) -> io::Result<Output> {
    if body.len() < STREAM_ID_LEN + SEQ_LEN {
        return Err(invalid("an output frame without its header"));
    }
    let stream = u64::from_le_bytes(body[..STREAM_ID_LEN].try_into().expect("eight bytes"));
    let seq = u32::from_le_bytes(
        body[STREAM_ID_LEN..STREAM_ID_LEN + SEQ_LEN]
            .try_into()
            .expect("four bytes"),
    );
    // In place: the output itself is not copied again.
    body.drain(..STREAM_ID_LEN + SEQ_LEN);
    Ok(Output {
        stream: StreamId(stream),
        seq,
        bytes: body,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{HostError, Response, TerminalSize};

    #[test]
    fn a_request_arrives_as_it_was_sent() {
        let mut bytes = Vec::new();
        write_client_message(
            &mut bytes,
            ClientMessage::Request {
                id: 7,
                request: Request::PtyResize {
                    terminal_id: "t1".into(),
                    size: TerminalSize {
                        cols: 120,
                        rows: 40,
                    },
                },
            },
        )
        .unwrap();
        write_client_message(
            &mut bytes,
            ClientMessage::Post {
                request: Request::PtyAck {
                    terminal_id: "t1".into(),
                    stream: StreamId(2),
                    seq: 3,
                },
            },
        )
        .unwrap();

        let mut reader = bytes.as_slice();
        assert!(matches!(
            read_client_message(&mut reader).unwrap(),
            Some(ClientFrame::Message(ClientMessage::Request {
                id: 7,
                request: Request::PtyResize { terminal_id, size: TerminalSize { cols: 120, rows: 40 } },
            })) if terminal_id == "t1"
        ));
        assert!(matches!(
            read_client_message(&mut reader).unwrap(),
            Some(ClientFrame::Message(ClientMessage::Post {
                request: Request::PtyAck {
                    stream: StreamId(2),
                    seq: 3,
                    ..
                }
            }))
        ));
        // The stream ended between two frames.
        assert!(read_client_message(&mut reader).unwrap().is_none());
    }

    #[test]
    fn a_sessions_output_travels_as_bytes_and_everything_else_as_messages() {
        let output: Vec<u8> = (0..=255).collect();
        let mut bytes = Vec::new();
        write_host_message(
            &mut bytes,
            HostMessage::Output(Output {
                stream: StreamId(3),
                seq: 9,
                bytes: output.clone(),
            }),
        )
        .unwrap();
        write_host_message(
            &mut bytes,
            HostMessage::Reply {
                id: 9,
                reply: Err(HostError::session_not_found("t1")),
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
        // The header, the stream id, the sequence number and the bytes
        // themselves: nothing encoded.
        let body = FRAME_HEADER_LEN + STREAM_ID_LEN + SEQ_LEN;
        assert_eq!(&bytes[body..body + 256], &output[..]);

        let mut reader = bytes.as_slice();
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Output(Output { stream: StreamId(3), seq: 9, bytes })) if bytes == output
        ));
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Reply { id: 9, reply: Err(error) }) if error == HostError::session_not_found("t1")
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
    fn frames_of_a_later_version_are_skipped() {
        let mut bytes = Vec::new();
        write_frame(&mut bytes, 77, &[b"something new"]).unwrap();
        write_frame(
            &mut bytes,
            KIND_MESSAGE,
            &[br#"{"type":"teleport","to":"mars"}"#],
        )
        .unwrap();
        write_host_message(
            &mut bytes,
            HostMessage::Reply {
                id: 1,
                reply: Ok(Response::Done),
            },
        )
        .unwrap();
        assert!(matches!(
            read_host_message(&mut bytes.as_slice()).unwrap(),
            Some(HostMessage::Reply { id: 1, .. })
        ));
    }

    /// A spawn of a later client: a shell type this build does not know.
    const SPAWN_OF_A_LATER_SHELL: &[u8] = br#"{"type":"request","id":5,"request":{"type":"ptySpawn","options":{"terminal_id":"t1","size":{"cols":80,"rows":24},"profile":{"shell_type":"Fish"},"integration_version":"9"},"window":"main","stream":1,"env":[],"lifetime":"endsWithClient"}}"#;

    #[test]
    fn a_request_that_cannot_be_read_comes_with_its_id_and_the_next_one_follows() {
        let mut bytes = Vec::new();
        write_frame(&mut bytes, KIND_MESSAGE, &[SPAWN_OF_A_LATER_SHELL]).unwrap();
        write_frame(
            &mut bytes,
            KIND_MESSAGE,
            &[br#"{"type":"post","request":{"type":"ptyWrite","terminal_id":"t1","data":7}}"#],
        )
        .unwrap();
        write_client_message(
            &mut bytes,
            ClientMessage::Request {
                id: 6,
                request: Request::ListSessions,
            },
        )
        .unwrap();

        let mut reader = bytes.as_slice();
        assert!(matches!(
            read_client_message(&mut reader).unwrap(),
            Some(ClientFrame::Unreadable { id: Some(5), .. })
        ));
        assert!(matches!(
            read_client_message(&mut reader).unwrap(),
            Some(ClientFrame::Unreadable { id: None, .. })
        ));
        assert!(matches!(
            read_client_message(&mut reader).unwrap(),
            Some(ClientFrame::Message(ClientMessage::Request {
                id: 6,
                request: Request::ListSessions
            }))
        ));
    }

    #[test]
    fn a_reply_that_cannot_be_read_fails_its_request_and_an_event_is_skipped() {
        let mut bytes = Vec::new();
        write_frame(
            &mut bytes,
            KIND_MESSAGE,
            &[br#"{"type":"reply","id":3,"reply":{"Ok":{"type":"shells","shells":[{"name":"fish","path":"/bin/fish","shell_type":"Fish"}]}}}"#],
        )
        .unwrap();
        write_frame(
            &mut bytes,
            KIND_MESSAGE,
            &[br#"{"type":"event","event":{"type":"ptyExit","terminal_id":"t1","window":7}}"#],
        )
        .unwrap();
        write_host_message(
            &mut bytes,
            HostMessage::Reply {
                id: 4,
                reply: Ok(Response::Done),
            },
        )
        .unwrap();

        let mut reader = bytes.as_slice();
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Reply {
                id: 3,
                reply: Err(HostError {
                    code: HostErrorCode::Unknown,
                    ..
                })
            })
        ));
        assert!(matches!(
            read_host_message(&mut reader).unwrap(),
            Some(HostMessage::Reply {
                id: 4,
                reply: Ok(Response::Done)
            })
        ));
    }

    #[test]
    fn a_frame_that_is_no_message_at_all_is_a_broken_stream() {
        let mut bytes = Vec::new();
        write_frame(&mut bytes, KIND_MESSAGE, &[b"not json"]).unwrap();
        assert!(read_client_message(&mut bytes.as_slice()).is_err());
        assert!(read_host_message(&mut bytes.as_slice()).is_err());
    }

    #[test]
    fn the_hellos_come_back_as_they_were_written() {
        let mut bytes = Vec::new();
        write_host_hello(&mut bytes).unwrap();
        let client = ClientHello::of_this_build(Some("laptop".into()));
        write_client_hello(&mut bytes, &client).unwrap();

        let mut reader = bytes.as_slice();
        read_preamble(&mut reader).unwrap();
        let host = read_host_hello(&mut reader).unwrap();
        assert_eq!(host.protocol, PROTOCOL_VERSION);
        assert_eq!(host.oldest, OLDEST_PROTOCOL_VERSION);
        assert_eq!(host.os, std::env::consts::OS);
        assert_eq!(read_client_hello(&mut reader).unwrap(), client);
    }

    #[test]
    fn ends_whose_versions_meet_talk() {
        assert_eq!(
            check_versions(PROTOCOL_VERSION, OLDEST_PROTOCOL_VERSION),
            Ok(())
        );
        // A later build that still speaks this one's version.
        assert_eq!(
            check_versions(PROTOCOL_VERSION + 1, PROTOCOL_VERSION),
            Ok(())
        );
    }

    #[test]
    fn without_a_version_in_common_the_older_end_is_named() {
        assert_eq!(
            check_versions(PROTOCOL_VERSION + 2, PROTOCOL_VERSION + 1),
            Err(VersionMismatch::ThisIsOlder)
        );
        assert_eq!(
            check_versions(OLDEST_PROTOCOL_VERSION - 1, 0),
            Err(VersionMismatch::TheyAreOlder)
        );
    }

    #[test]
    fn a_stream_without_a_host_behind_it_is_an_error() {
        let mut reader: &[u8] = b"bash: cogno: command not found\n";
        assert!(read_preamble(&mut reader).is_err());
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
