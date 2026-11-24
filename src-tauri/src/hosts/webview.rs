//! What the hosts report, delivered to the webview: a session's output over
//! its channel, events to the window they concern, coding agents' hooks as
//! Cogno messages; what a host passes on to be answered goes to `questions`.

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use cogno_host::protocol::{Event, ExitReason, StreamId};
use cogno_host::sync::lock;
use cogno_host::wire::Output;
use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter};

use super::questions;
use super::routes::TerminalRoutes;
use crate::cogno_message::{CognoMessage, COGNO_MESSAGE_EVENT};
use crate::commands::window_registry::route;
use crate::host_connection::{Answers, HostEvents};

/// Largest framed chunk ever handed to the webview channel in one message.
///
/// Root cause found by direct correlation (per-send logging of size vs. what
/// the frontend reported lost): Tauri delivers small raw channel payloads via
/// a synchronous, reliable `webview.eval()`; payloads whose framed size
/// crosses roughly 1 KiB instead go through an async fetch against a
/// `ChannelDataIpcQueue`, which silently drops messages under conditions this
/// investigation could not further characterize (a known class of issue -
/// see e.g. tauri-apps/tauri#10546 - not something this codebase controls).
/// PTY reads land suspiciously often at exactly the OS's PTY buffering
/// granularity (1024 bytes), which combined with the 4-byte seq header
/// crossed that boundary on nearly every chunk `top` produced - explaining
/// losses that persisted no matter how send concurrency/pacing was tuned.
/// Every chunk is now kept comfortably under the boundary so it always takes
/// the reliable path; this alone eliminated 100% of observed drops.
const MAX_CHUNK_LEN: usize = 900;

/// Every chunk starts with its sequence number (u32, little endian). The
/// webview restores order from it and acknowledges by it, so a chunk lost in
/// transit costs that chunk, not the session.
const CHUNK_HEADER_LEN: usize = 4;
/// Sequence numbers wrap; one is at or before another within this distance.
const HALF_SEQ_RANGE: u32 = 1 << 31;

/// The events of one terminal, as `<name>:<terminal id>`.
pub const PTY_EXIT_EVENT: &str = "pty-exit";
pub const PTY_HANDED_BACK_EVENT: &str = "pty-handed-back";
pub const PTY_TAKEN_OVER_EVENT: &str = "pty-taken-over";
/// To every window: the connection to a host on another machine ended.
pub const HOST_DISCONNECTED_EVENT: &str = "host-disconnected";

fn terminal_event(name: &str, terminal_id: &str) -> String {
    format!("{name}:{terminal_id}")
}

/// Why a terminal of this app ended, as the webview receives it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TerminalExit {
    Exited {
        code: i32,
    },
    KilledByAnotherClient,
    PtyFailed,
    /// The connection to the host broke; the shell may run on there.
    ConnectionLost,
    /// The user hung up on the host; the shell runs on there.
    HungUp,
}

impl From<ExitReason> for TerminalExit {
    fn from(reason: ExitReason) -> Self {
        match reason {
            ExitReason::Exited { code } => TerminalExit::Exited { code },
            ExitReason::KilledByAnotherClient => TerminalExit::KilledByAnotherClient,
            // A reason of a later host: ended, and not by the shell itself.
            ExitReason::PtyFailed | ExitReason::Unknown => TerminalExit::PtyFailed,
        }
    }
}

#[derive(Clone, Serialize)]
struct ExitPayload {
    reason: TerminalExit,
}

#[derive(Clone, Serialize)]
struct TakenOverPayload {
    by: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostDisconnected {
    /// The id the machine is paired under.
    host: String,
    /// Whether the connection broke, as opposed to this app hanging up.
    lost: bool,
}

/// A session's output on its way to the webview.
struct Stream {
    channel: Channel<InvokeResponseBody>,
    /// The sequence number of the next chunk.
    next_chunk: u32,
    /// The host's pieces not yet acknowledged, oldest first: the last chunk
    /// each was cut into, and its own sequence number.
    pieces: VecDeque<(u32, u32)>,
}

/// The webview channel of every session whose output is still coming.
#[derive(Default)]
pub struct Streams {
    next: AtomicU64,
    open: Mutex<HashMap<StreamId, Stream>>,
}

impl Streams {
    pub fn open(&self, channel: Channel<InvokeResponseBody>) -> StreamId {
        let stream = StreamId(self.next.fetch_add(1, Ordering::Relaxed));
        lock(&self.open).insert(
            stream,
            Stream {
                channel,
                next_chunk: 0,
                pieces: VecDeque::new(),
            },
        );
        stream
    }

    pub fn close(&self, stream: StreamId) {
        lock(&self.open).remove(&stream);
    }

    /// Cuts a piece of output into chunks the webview takes reliably and
    /// sends them; nothing once the stream is closed. A webview that is gone
    /// takes nothing: its window's end closes the stream.
    fn deliver(&self, output: Output) {
        let (channel, chunks) = {
            let mut open = lock(&self.open);
            let Some(stream) = open.get_mut(&output.stream) else {
                return;
            };
            let chunks: Vec<Vec<u8>> = output
                .bytes
                .chunks(MAX_CHUNK_LEN)
                .map(|chunk| {
                    let framed = frame_chunk(stream.next_chunk, chunk);
                    stream.next_chunk = stream.next_chunk.wrapping_add(1);
                    framed
                })
                .collect();
            stream
                .pieces
                .push_back((stream.next_chunk.wrapping_sub(1), output.seq));
            (stream.channel.clone(), chunks)
        };
        // Sent outside the lock: one slow webview must not hold up the
        // output of the other sessions.
        for chunk in chunks {
            if channel.send(InvokeResponseBody::Raw(chunk)).is_err() {
                return;
            }
        }
    }

    /// The webview took in every chunk up to and including `chunk`: the
    /// host's sequence number this acknowledges, if it completes a piece.
    /// `channel` is the one the webview took the chunks through: an ack of
    /// an earlier open of the terminal, late, counts for nothing.
    pub fn acknowledged(&self, stream: StreamId, channel: u32, chunk: u32) -> Option<u32> {
        let mut open = lock(&self.open);
        let stream = open
            .get_mut(&stream)
            .filter(|open| open.channel.id() == channel)?;
        let pieces = &mut stream.pieces;
        let mut through = None;
        while let Some(&(last_chunk, seq)) = pieces.front() {
            // Wrapping: the piece's last chunk is at or before `chunk`.
            if chunk.wrapping_sub(last_chunk) >= HALF_SEQ_RANGE {
                break;
            }
            pieces.pop_front();
            through = Some(seq);
        }
        through
    }
}

fn frame_chunk(seq: u32, data: &[u8]) -> Vec<u8> {
    let mut frame = Vec::with_capacity(CHUNK_HEADER_LEN + data.len());
    frame.extend_from_slice(&seq.to_le_bytes());
    frame.extend_from_slice(data);
    frame
}

/// Where what every host reports goes.
pub struct WebviewEvents {
    app: AppHandle,
    pub streams: Streams,
    routes: Arc<TerminalRoutes>,
}

impl WebviewEvents {
    pub fn new(app: AppHandle, routes: Arc<TerminalRoutes>) -> Self {
        Self {
            app,
            streams: Streams::default(),
            routes,
        }
    }

    /// Tells `window` that its terminal ended.
    pub fn exit(&self, window: &str, terminal_id: &str, reason: TerminalExit) {
        let _ = self.app.emit_to(
            window,
            &terminal_event(PTY_EXIT_EVENT, terminal_id),
            ExitPayload { reason },
        );
    }

    /// Tells every window that the connection to `host` ended: `lost`
    /// without this app hanging up, or hung up on.
    pub fn disconnected(&self, host: &str, lost: bool) {
        let _ = self.app.emit(
            HOST_DISCONNECTED_EVENT,
            HostDisconnected {
                host: host.to_string(),
                lost,
            },
        );
    }
}

impl HostEvents for WebviewEvents {
    fn event(&self, event: Event, answers: &Answers) {
        match event {
            Event::PtyStreamEnded { stream } => self.streams.close(stream),
            Event::PtyExit {
                terminal_id,
                window,
                reason,
            } => {
                self.routes.remove(&terminal_id);
                self.exit(&window, &terminal_id, reason.into());
            }
            // The Cogno that took the session let it go: the window that
            // showed it before may show it again.
            Event::PtyHandedBack {
                terminal_id,
                window,
            } => {
                let _ = self.app.emit_to(
                    window.as_str(),
                    &terminal_event(PTY_HANDED_BACK_EVENT, &terminal_id),
                    (),
                );
            }
            // Another Cogno shows the session now: it is not this window's
            // any more, and the window is told.
            Event::PtyTakenOver {
                terminal_id,
                window,
                by,
            } => {
                self.routes.remove_of_window(&terminal_id, &window);
                let _ = self.app.emit_to(
                    window.as_str(),
                    &terminal_event(PTY_TAKEN_OVER_EVENT, &terminal_id),
                    TakenOverPayload { by },
                );
            }
            // A coding agent's hook, in a terminal this app shows - or, naming
            // none, in whichever terminal its session runs.
            Event::AgentHook { hook, replayed } => {
                let terminal_id = hook.terminal_id.clone();
                route(
                    &self.app,
                    COGNO_MESSAGE_EVENT,
                    CognoMessage::of_agent_hook(hook, replayed),
                    terminal_id.as_deref(),
                );
            }
            Event::Asked {
                relay,
                to,
                question,
            } => {
                questions::answer(&self.app, relay, to, &question, answers);
            }
            // Something a later host reports: nothing here to do with it.
            Event::Unknown => {}
        }
    }

    fn output(&self, output: Output) {
        self.streams.deliver(output);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A stream whose pieces were cut into these many chunks each.
    fn delivered(pieces: &[usize]) -> (Streams, StreamId, u32) {
        let streams = Streams::default();
        let stream = StreamId(7);
        let mut entry = Stream {
            channel: Channel::new(|_| Ok(())),
            next_chunk: 0,
            pieces: VecDeque::new(),
        };
        for (seq, chunks) in pieces.iter().enumerate() {
            entry.next_chunk += *chunks as u32;
            entry.pieces.push_back((entry.next_chunk - 1, seq as u32));
        }
        let channel = entry.channel.id();
        lock(&streams.open).insert(stream, entry);
        (streams, stream, channel)
    }

    #[test]
    fn a_piece_is_acknowledged_to_the_host_once_its_last_chunk_is() {
        // Pieces 0, 1, 2 of 3, 1 and 2 chunks: chunks 0-2, 3, 4-5.
        let (streams, stream, channel) = delivered(&[3, 1, 2]);

        assert_eq!(streams.acknowledged(stream, channel, 1), None);
        assert_eq!(streams.acknowledged(stream, channel, 3), Some(1));
        // Chunks the webview skipped (lost in transit) are covered too.
        assert_eq!(streams.acknowledged(stream, channel, 9), Some(2));
        assert_eq!(streams.acknowledged(stream, channel, 9), None);
    }

    #[test]
    fn an_ack_through_another_channel_counts_for_nothing() {
        let (streams, stream, channel) = delivered(&[3, 1, 2]);

        // Late, from an earlier open of the same terminal.
        assert_eq!(
            streams.acknowledged(stream, channel.wrapping_add(1), 9),
            None
        );
        assert_eq!(streams.acknowledged(stream, channel, 9), Some(2));
    }

    #[test]
    fn chunks_are_cut_to_the_size_the_webview_takes_reliably() {
        let framed = frame_chunk(0x0102_0304, &[b'x'; MAX_CHUNK_LEN]);
        assert_eq!(&framed[..CHUNK_HEADER_LEN], &[0x04, 0x03, 0x02, 0x01]);
        assert!(framed.len() < 1024);
    }

    #[test]
    fn the_webview_learns_why_a_terminal_ended() {
        let exit = ExitPayload {
            reason: ExitReason::Exited { code: 3 }.into(),
        };
        assert_eq!(
            serde_json::to_value(exit).unwrap(),
            serde_json::json!({ "reason": { "kind": "exited", "code": 3 } })
        );
    }
}
