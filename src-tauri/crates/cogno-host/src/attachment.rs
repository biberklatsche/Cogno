//! A client that shows a session, and the windows sessions belong to.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use crate::flow_control::FlowControl;
use crate::host::{Client, ClientId, EventSink};
use crate::protocol::{Event, ExitReason, StreamId, TerminalId, WindowLabel};
use crate::wire::Output;

/// Whom a session belongs to: a window of a client. Two clients may name
/// their windows alike.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct Owner {
    pub client: ClientId,
    pub window: WindowLabel,
}

/// A client that shows a session: where its output goes, under which stream,
/// and how much of it the client has not taken in yet.
#[derive(Clone)]
pub(crate) struct Attachment {
    pub client: ClientId,
    /// What the client calls itself, for another client it takes the session
    /// from.
    pub client_name: Option<String>,
    stream: StreamId,
    sink: Arc<dyn EventSink>,
    /// One per attachment; its `Arc` is the attachment's identity.
    flow: Arc<FlowControl>,
    next_seq: Arc<AtomicU32>,
}

impl Attachment {
    pub fn new(client: &Client, stream: StreamId) -> Self {
        Self::with_flow(client, stream, FlowControl::new())
    }

    pub fn with_flow(client: &Client, stream: StreamId, flow: FlowControl) -> Self {
        Self {
            client: client.id,
            client_name: client.name.clone(),
            stream,
            sink: client.sink.clone(),
            flow: Arc::new(flow),
            next_seq: Arc::new(AtomicU32::new(0)),
        }
    }

    pub fn is(&self, other: &Attachment) -> bool {
        Arc::ptr_eq(&self.flow, &other.flow)
    }

    /// Sends what the shell wrote, counted against the flow control: waits
    /// for the client while it is behind. False once the attachment is over:
    /// closed, or the client is gone.
    pub fn send(&self, bytes: &[u8]) -> bool {
        let seq = self.next_seq.load(Ordering::Relaxed);
        self.flow.acquire(seq, bytes.len()) && self.deliver(seq, bytes)
    }

    /// Sends what was kept, without counting it: no more is kept than a
    /// client may be behind anyway, and waiting for its acknowledgement
    /// would hold the session the acknowledgement needs.
    pub fn replay(&self, bytes: &[u8]) {
        if !bytes.is_empty() {
            self.deliver(self.next_seq.load(Ordering::Relaxed), bytes);
        }
    }

    fn deliver(&self, seq: u32, bytes: &[u8]) -> bool {
        let delivered = self.sink.output(Output {
            stream: self.stream,
            seq,
            bytes: bytes.to_vec(),
        });
        if delivered {
            self.next_seq.store(seq.wrapping_add(1), Ordering::Relaxed);
        }
        delivered
    }

    /// The client has taken in everything up to and including `seq`.
    pub fn acknowledge(&self, seq: u32) {
        self.flow.ack_through(seq);
    }

    /// Wakes the reader if it waits for this client, and lets it send no more.
    pub fn stop(&self) {
        self.flow.close();
    }

    /// Nothing more comes under this stream: the client is told.
    pub fn end(&self) {
        self.stop();
        self.sink.event(Event::PtyStreamEnded {
            stream: self.stream,
        });
    }

    /// Tells the client that the session ended.
    pub fn tell_exit(&self, terminal_id: &str, window: &str, reason: ExitReason) {
        self.sink.event(Event::PtyExit {
            terminal_id: terminal_id.to_string(),
            window: window.to_string(),
            reason,
        });
    }

    /// Tells the client that `taker` took the session of its `window`.
    pub fn tell_taken_over(&self, terminal_id: &str, window: &str, taker: Option<String>) {
        self.sink.event(Event::PtyTakenOver {
            terminal_id: terminal_id.to_string(),
            window: window.to_string(),
            by: taker,
        });
    }

    #[cfg(test)]
    pub fn sent_pieces(&self) -> u32 {
        self.next_seq.load(Ordering::Relaxed)
    }

    #[cfg(all(test, windows))]
    pub fn in_flight(&self) -> usize {
        self.flow.in_flight()
    }
}

/// Who showed a session until another client took it over: told when that
/// one lets it go, so it can show the session again.
pub(crate) struct TakenFrom {
    pub owner: Owner,
    sink: Arc<dyn EventSink>,
}

impl TakenFrom {
    pub fn of(owner: Owner, showed: &Attachment) -> Self {
        Self {
            owner,
            sink: showed.sink.clone(),
        }
    }

    /// The pane that waits for the session learns that it will not come back.
    pub fn tell_exit(self, terminal_id: &TerminalId, reason: ExitReason) {
        self.sink.event(Event::PtyExit {
            terminal_id: terminal_id.clone(),
            window: self.owner.window,
            reason,
        });
    }

    pub fn tell_handed_back(self, terminal_id: &TerminalId) {
        self.sink.event(Event::PtyHandedBack {
            terminal_id: terminal_id.clone(),
            window: self.owner.window,
        });
    }
}
