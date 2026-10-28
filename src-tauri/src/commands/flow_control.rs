use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Condvar, Mutex};

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
pub(super) const MAX_CHUNK_SIZE: usize = 900;

/// Bytes handed to the webview but not yet acknowledged before the reader
/// thread stops reading (and thereby blocks the shell on stdout, like a real
/// terminal would).
const HIGH_WATERMARK: usize = 1024 * 1024;

/// Reader resumes once unacknowledged bytes drop below this (hysteresis).
const LOW_WATERMARK: usize = 256 * 1024;

/// Every data message starts with the chunk's sequence number (u32, little
/// endian). The frontend restores order from it and acknowledges by sequence
/// number, so a chunk lost in transit costs that chunk, not the session.
const CHUNK_HEADER_LEN: usize = 4;

pub(super) fn frame_chunk(seq: u32, data: &[u8]) -> Vec<u8> {
    let mut frame = Vec::with_capacity(CHUNK_HEADER_LEN + data.len());
    frame.extend_from_slice(&seq.to_le_bytes());
    frame.extend_from_slice(data);
    frame
}

struct FlowState {
    in_flight_bytes: usize,
    /// Sent but unacknowledged (parsed) chunks in sequence order. Ordered
    /// popping is enough here since parse acks arrive in sequence order.
    sent: VecDeque<(u32, usize)>,
}

/// Backpressure between the PTY reader thread and the webview: once more
/// than `high_watermark` bytes are sent but not yet parsed, the reader stops
/// reading until the frontend's ack brings the backlog below
/// `low_watermark` (hysteresis). A shell that outpaces rendering therefore
/// genuinely blocks on stdout, like it would on a real terminal.
///
/// Also the reader's stop signal: `close()` wakes a waiting reader and makes
/// every later `acquire` fail, so kill/exit never needs an ack to unblock it.
/// The `Arc<FlowControl>` identifies one spawn (terminal ids can be reused).
pub(crate) struct FlowControl {
    state: Mutex<FlowState>,
    capacity_available: Condvar,
    closed: AtomicBool,
    high_watermark: usize,
    low_watermark: usize,
}

impl FlowControl {
    pub(super) fn new() -> Self {
        Self::with_watermarks(HIGH_WATERMARK, LOW_WATERMARK)
    }

    fn with_watermarks(high_watermark: usize, low_watermark: usize) -> Self {
        Self {
            state: Mutex::new(FlowState {
                in_flight_bytes: 0,
                sent: VecDeque::new(),
            }),
            capacity_available: Condvar::new(),
            closed: AtomicBool::new(false),
            high_watermark,
            low_watermark,
        }
    }

    pub(super) fn is_closed(&self) -> bool {
        self.closed.load(Ordering::Acquire)
    }

    /// Registers chunk `seq` of `bytes` as in flight. Blocks first while more
    /// than the high watermark is unparsed, for as long as it takes (real
    /// backpressure). Returns false once the flow is closed.
    pub(super) fn acquire(&self, seq: u32, bytes: usize) -> bool {
        let mut state = self.state.lock().unwrap();
        if state.in_flight_bytes > self.high_watermark {
            while !self.is_closed() && state.in_flight_bytes >= self.low_watermark {
                state = self.capacity_available.wait(state).unwrap();
            }
        }
        if self.is_closed() {
            return false;
        }
        state.in_flight_bytes = state.in_flight_bytes.saturating_add(bytes);
        state.sent.push_back((seq, bytes));
        true
    }

    /// Frontend has parsed every chunk up to and including `seq`: releases
    /// those bytes, including the bytes of chunks lost in transit before
    /// `seq`, which the frontend skipped.
    pub(super) fn ack_through(&self, seq: u32) {
        let mut state = self.state.lock().unwrap();
        while state
            .sent
            .front()
            .is_some_and(|(sent_seq, _)| *sent_seq <= seq)
        {
            let (_, bytes) = state.sent.pop_front().unwrap();
            state.in_flight_bytes = state.in_flight_bytes.saturating_sub(bytes);
        }
        self.capacity_available.notify_all();
    }

    /// Stops the reader for good: wakes a waiting reader and makes every later
    /// `acquire` fail. Idempotent.
    pub(super) fn close(&self) {
        // Set under the lock so a reader that checks `closed` while holding
        // the state lock can never miss the notification.
        let _state = self.state.lock().unwrap();
        self.closed.store(true, Ordering::Release);
        self.capacity_available.notify_all();
    }

    #[cfg(test)]
    fn in_flight(&self) -> usize {
        self.state.lock().unwrap().in_flight_bytes
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;
    use std::time::{Duration, Instant};

    fn short() -> Duration {
        Duration::from_millis(50)
    }

    #[test]
    fn acquire_does_not_wait_below_high_watermark() {
        let flow = FlowControl::with_watermarks(100, 50);
        assert!(flow.acquire(0, 100));
        let start = Instant::now();
        assert!(flow.acquire(1, 1));
        assert!(start.elapsed() < short());
        assert_eq!(flow.in_flight(), 101);
    }

    #[test]
    fn acquire_waits_until_acks_drop_below_low_watermark() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        assert!(flow.acquire(0, 60));
        assert!(flow.acquire(1, 90)); // 150 in flight: the next acquire waits

        let waiter = {
            let flow = flow.clone();
            thread::spawn(move || {
                let start = Instant::now();
                let acquired = flow.acquire(2, 10);
                (acquired, start.elapsed())
            })
        };

        thread::sleep(Duration::from_millis(30));
        flow.ack_through(0); // 90 in flight: still >= low watermark, keep waiting
        thread::sleep(Duration::from_millis(30));
        assert!(!waiter.is_finished());
        flow.ack_through(1); // 0 in flight: below low watermark, wake up
        let (acquired, waited) = waiter.join().unwrap();
        assert!(acquired);
        assert!(waited >= Duration::from_millis(50));
        assert_eq!(flow.in_flight(), 10);
    }

    #[test]
    fn ack_through_releases_every_chunk_up_to_seq_including_lost_ones() {
        let flow = FlowControl::with_watermarks(1_000, 500);
        assert!(flow.acquire(0, 10));
        assert!(flow.acquire(1, 20)); // never parsed by the frontend (lost in transit)
        assert!(flow.acquire(2, 30));
        assert!(flow.acquire(3, 40));
        flow.ack_through(2);
        assert_eq!(flow.in_flight(), 40);
        flow.ack_through(2); // duplicate ack: no effect
        assert_eq!(flow.in_flight(), 40);
        flow.ack_through(1_000); // ack beyond what was sent
        assert_eq!(flow.in_flight(), 0);
    }

    #[test]
    fn close_unblocks_a_waiting_reader_and_fails_the_acquire() {
        let flow = Arc::new(FlowControl::with_watermarks(100, 50));
        assert!(flow.acquire(0, 1_000));
        let waiter = {
            let flow = flow.clone();
            thread::spawn(move || flow.acquire(1, 1))
        };
        thread::sleep(Duration::from_millis(20));
        assert!(!waiter.is_finished());
        flow.close();
        assert!(!waiter.join().unwrap());
        assert!(flow.is_closed());
    }

    #[test]
    fn closed_flow_never_acquires_again() {
        let flow = FlowControl::with_watermarks(100, 50);
        flow.close();
        let start = Instant::now();
        assert!(!flow.acquire(0, 10));
        assert!(!flow.acquire(1, 10_000));
        assert!(start.elapsed() < short());
        assert_eq!(flow.in_flight(), 0);
        flow.close(); // idempotent
    }

    #[test]
    fn frame_chunk_prefixes_the_sequence_number_little_endian() {
        let frame = frame_chunk(0x0102_0304, b"ab");
        assert_eq!(frame, vec![0x04, 0x03, 0x02, 0x01, b'a', b'b']);
        assert_eq!(frame.len(), CHUNK_HEADER_LEN + 2);
    }
}
