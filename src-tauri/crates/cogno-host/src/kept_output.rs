//! What a session keeps of its output for a client that attaches later: the
//! tail of the byte stream as the shell wrote it, and the terminal modes that
//! are on. Played back into a fresh terminal, the two bring it to where the
//! session is. There is no terminal emulator here: the stream is only read
//! for the handful of sequences that switch a mode, and for the handshake of
//! the shell integration.
//!
//! The handshake is the one thing a shell says once, when it starts, that a
//! client cannot do without: what the shell is and what it can do. It is kept
//! apart, so a client that attaches after it has left the tail still gets it.
//!
//! The alternate screen (vim, less, a full-screen agent) is left out of the
//! tail on purpose. A terminal keeps no history of it either, and what a
//! program drew there was laid out for the old size: a client that attaches
//! is put into the alternate screen and the program redraws when the client
//! sets its size.

use std::collections::VecDeque;

/// How much output a session keeps. Enough for a long scroll back, and no
/// more than a client may be behind in any case (the flow control's high
/// watermark): playing it back on attach is one burst the client can take.
const KEPT_BYTES: usize = 1024 * 1024;
/// A control sequence longer than this is not one this module reads; it is
/// passed on as ordinary output.
const MAX_SEQUENCE_LEN: usize = 64;

/// An operating system command longer than this is passed on unread.
const MAX_OSC_LEN: usize = 4096;

const ESC: u8 = 0x1b;
const BEL: u8 = 0x07;
/// How the shell integration's handshake begins (`ARCHITECTURE.md` 2.1).
const HANDSHAKE_PREFIX: &[u8] = b"\x1b]733;COGNO:CAPS;";

/// The private modes (`ESC [ ? n h` / `l`) a fresh terminal has to be told
/// about, in the order they are replayed. All of them are off in a fresh
/// terminal except the cursor (25), which is on.
const TRACKED_MODES: [u16; 11] = [
    1,    // application cursor keys
    25,   // cursor visible
    1000, // mouse: clicks
    1002, // mouse: drag
    1003, // mouse: any motion
    1004, // focus events
    1005, // mouse encoding: UTF-8
    1006, // mouse encoding: SGR
    1015, // mouse encoding: urxvt
    1016, // mouse encoding: SGR pixels
    2004, // bracketed paste
];
const CURSOR_VISIBLE: u16 = 25;
/// The modes that switch to the alternate screen.
const ALTERNATE_SCREEN_MODES: [u16; 3] = [47, 1047, 1049];

enum Parser {
    Ground,
    /// After ESC.
    Escape,
    /// After `ESC [`; the bytes so far are in `pending`.
    Csi,
    /// After `ESC ]`, up to BEL or `ESC \\`.
    Osc,
}

/// The shell's last handshake, and where in the stream it stood.
struct Handshake {
    sequence: Vec<u8>,
    /// How many bytes had gone into the tail before it; `None` when it was
    /// not kept at all (written on the alternate screen).
    kept_before: Option<u64>,
}

pub(crate) struct KeptOutput {
    tail: VecDeque<u8>,
    capacity: usize,
    parser: Parser,
    /// The bytes of a sequence that is not complete yet.
    pending: Vec<u8>,
    /// Indexed like `TRACKED_MODES`.
    modes: [bool; TRACKED_MODES.len()],
    application_keypad: bool,
    alternate_screen: bool,
    handshake: Option<Handshake>,
    /// Bytes that ever went into the tail, and how many of them left it.
    kept: u64,
    dropped: u64,
}

impl KeptOutput {
    pub(crate) fn new() -> Self {
        Self::with_capacity(KEPT_BYTES)
    }

    fn with_capacity(capacity: usize) -> Self {
        let mut modes = [false; TRACKED_MODES.len()];
        modes[TRACKED_MODES
            .iter()
            .position(|mode| *mode == CURSOR_VISIBLE)
            .expect("tracked")] = true;
        Self {
            tail: VecDeque::new(),
            capacity,
            parser: Parser::Ground,
            pending: Vec::new(),
            modes,
            application_keypad: false,
            alternate_screen: false,
            handshake: None,
            kept: 0,
            dropped: 0,
        }
    }

    /// Takes the next piece of the session's output.
    pub(crate) fn push(&mut self, mut output: &[u8]) {
        while !output.is_empty() {
            match self.parser {
                Parser::Ground => {
                    // Everything up to the next ESC is ordinary output.
                    let plain = output
                        .iter()
                        .position(|byte| *byte == ESC)
                        .unwrap_or(output.len());
                    self.keep(&output[..plain]);
                    output = &output[plain..];
                    if !output.is_empty() {
                        self.pending.push(ESC);
                        self.parser = Parser::Escape;
                        output = &output[1..];
                    }
                }
                Parser::Escape => {
                    let byte = output[0];
                    output = &output[1..];
                    self.pending.push(byte);
                    match byte {
                        b'[' => self.parser = Parser::Csi,
                        b']' => self.parser = Parser::Osc,
                        b'=' | b'>' => {
                            self.application_keypad = byte == b'=';
                            self.pass_pending();
                        }
                        // Another ESC starts over; anything else is a
                        // sequence this module does not read.
                        ESC => {
                            self.pending.pop();
                            self.pass_pending();
                            self.pending.push(ESC);
                            self.parser = Parser::Escape;
                        }
                        _ => self.pass_pending(),
                    }
                }
                Parser::Csi => {
                    let byte = output[0];
                    output = &output[1..];
                    self.pending.push(byte);
                    // Parameters and intermediates are 0x20-0x3f; the first
                    // byte from 0x40 on ends the sequence.
                    if (0x40..=0x7e).contains(&byte) {
                        self.end_csi(byte);
                    } else if !(0x20..=0x3f).contains(&byte)
                        || self.pending.len() > MAX_SEQUENCE_LEN
                    {
                        self.pass_pending();
                    }
                }
                Parser::Osc => {
                    let byte = output[0];
                    output = &output[1..];
                    let after_escape = self.pending.last() == Some(&ESC);
                    self.pending.push(byte);
                    if byte == BEL || (byte == b'\\' && after_escape) {
                        self.end_osc();
                    } else if self.pending.len() > MAX_OSC_LEN {
                        self.pass_pending();
                    }
                }
            }
        }
    }

    /// A complete `ESC ] ... terminator`: remembered if it is the handshake,
    /// and ordinary output either way.
    fn end_osc(&mut self) {
        if self.pending.starts_with(HANDSHAKE_PREFIX) {
            self.handshake = Some(Handshake {
                sequence: self.pending.clone(),
                kept_before: (!self.alternate_screen).then_some(self.kept),
            });
        }
        self.pass_pending();
    }

    /// A complete `ESC [ ... final`: read it if it sets private modes.
    fn end_csi(&mut self, last: u8) {
        let parameters = &self.pending[2..self.pending.len() - 1];
        let sets = match last {
            b'h' => Some(true),
            b'l' => Some(false),
            _ => None,
        };
        let (Some(on), Some(b'?')) = (sets, parameters.first().copied()) else {
            self.pass_pending();
            return;
        };
        let was_alternate = self.alternate_screen;
        let mut switches_screen = false;
        for mode in parameters[1..]
            .split(|byte| *byte == b';')
            .filter_map(|digits| std::str::from_utf8(digits).ok()?.parse::<u16>().ok())
        {
            if ALTERNATE_SCREEN_MODES.contains(&mode) {
                self.alternate_screen = on;
                switches_screen = true;
            } else if let Some(index) = TRACKED_MODES.iter().position(|tracked| *tracked == mode) {
                self.modes[index] = on;
            }
        }
        if switches_screen {
            // The switch itself is not kept: the tail is the normal screen's,
            // as if the program in between had never drawn.
            self.pending.clear();
            self.parser = Parser::Ground;
        } else if was_alternate {
            self.pending.clear();
            self.parser = Parser::Ground;
        } else {
            self.pass_pending();
        }
    }

    /// The pending bytes turned out to be ordinary output.
    fn pass_pending(&mut self) {
        let pending = std::mem::take(&mut self.pending);
        self.keep(&pending);
        self.parser = Parser::Ground;
    }

    fn keep(&mut self, output: &[u8]) {
        if self.alternate_screen || output.is_empty() {
            return;
        }
        self.tail.extend(output);
        self.kept += output.len() as u64;
        let Some(excess) = self.tail.len().checked_sub(self.capacity + 1) else {
            return;
        };
        // Cut behind a line end, so the tail does not begin inside a line or
        // a sequence. Without one in reach, the bytes go as they are.
        let cut = self
            .tail
            .iter()
            .skip(excess)
            .position(|byte| *byte == b'\n')
            .map_or(excess + 1, |line_end| excess + line_end + 1);
        let cut = cut.min(self.tail.len());
        self.tail.drain(..cut);
        self.dropped += cut as u64;
    }

    /// What brings a fresh terminal to where the session is: the handshake if
    /// it is no longer in the tail, the kept output, then the modes as they
    /// are now. The modes come last because the output before them switches
    /// them back and forth on its way.
    pub(crate) fn replay(&self) -> Vec<u8> {
        let mut replay = Vec::with_capacity(self.tail.len() + 512);
        if let Some(handshake) = &self.handshake {
            let still_in_tail = handshake
                .kept_before
                .is_some_and(|kept_before| kept_before >= self.dropped);
            if !still_in_tail {
                replay.extend_from_slice(&handshake.sequence);
            }
        }
        let (front, back) = self.tail.as_slices();
        replay.extend_from_slice(front);
        replay.extend_from_slice(back);
        if self.alternate_screen {
            replay.extend_from_slice(b"\x1b[?1049h");
        }
        for (mode, on) in TRACKED_MODES.iter().zip(self.modes) {
            // What a fresh terminal has anyway needs no saying.
            if on != (*mode == CURSOR_VISIBLE) {
                replay.extend_from_slice(
                    format!("\x1b[?{mode}{}", if on { 'h' } else { 'l' }).as_bytes(),
                );
            }
        }
        if self.application_keypad {
            replay.extend_from_slice(b"\x1b=");
        }
        replay
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn replay_of(pieces: &[&[u8]]) -> String {
        let mut kept = KeptOutput::new();
        for piece in pieces {
            kept.push(piece);
        }
        String::from_utf8(kept.replay()).unwrap()
    }

    #[test]
    fn output_comes_back_as_it_was_written() {
        let colored = b"\x1b[32mok\x1b[0m line one\r\nline two\r\n\x1b]0;title\x07$ ";
        assert_eq!(replay_of(&[colored]).as_bytes(), colored);
    }

    #[test]
    fn modes_that_are_on_are_told_after_the_output() {
        let replay = replay_of(&[b"\x1b[?2004h\x1b[?1000;1006h$ vim\r\n\x1b[?25l"]);
        assert_eq!(
            replay,
            "\x1b[?2004h\x1b[?1000;1006h$ vim\r\n\x1b[?25l\x1b[?25l\x1b[?1000h\x1b[?1006h\x1b[?2004h"
        );
    }

    #[test]
    fn a_mode_switched_off_again_is_not_told() {
        let replay = replay_of(&[b"\x1b[?2004h$ ls\r\n\x1b[?2004l"]);
        assert_eq!(replay, "\x1b[?2004h$ ls\r\n\x1b[?2004l");
    }

    #[test]
    fn a_mode_whose_switch_fell_out_of_the_tail_is_still_told() {
        let mut kept = KeptOutput::with_capacity(16);
        kept.push(b"\x1b[?2004h");
        kept.push(b"a long line of output\nand another one\nlast\n");

        let replay = String::from_utf8(kept.replay()).unwrap();
        assert!(!replay.starts_with("\x1b[?2004h"));
        assert!(replay.ends_with("last\n\x1b[?2004h"));
    }

    #[test]
    fn what_a_full_screen_program_drew_is_left_out_and_the_screen_is_entered() {
        let replay = replay_of(&[
            b"$ vim notes\r\n",
            b"\x1b[?1049h\x1b[2J\x1b[1;1Hfile content\x1b[5;1H~",
        ]);
        assert_eq!(replay, "$ vim notes\r\n\x1b[?1049h");
    }

    #[test]
    fn after_a_full_screen_program_ended_the_tail_goes_on_as_if_it_never_ran() {
        let replay = replay_of(&[
            b"$ vim notes\r\n\x1b[?1049h\x1b[2Jfile content",
            b"\x1b[?1049l$ ",
        ]);
        assert_eq!(replay, "$ vim notes\r\n$ ");
    }

    #[test]
    fn modes_a_full_screen_program_switched_are_kept_while_it_runs() {
        let replay = replay_of(&[b"$ \x1b[?1049h\x1b[?1h\x1b=\x1b[?25l"]);
        assert_eq!(replay, "$ \x1b[?1049h\x1b[?1h\x1b[?25l\x1b=");
    }

    #[test]
    fn a_sequence_split_between_two_reads_is_read_whole() {
        let replay = replay_of(&[b"$ \x1b", b"[?10", b"49", b"h drawn", b"\x1b[?1049", b"l$ "]);
        assert_eq!(replay, "$ $ ");
    }

    #[test]
    fn sequences_this_module_does_not_read_pass_unchanged() {
        // A cursor move, a charset selection, an OSC, a lone ESC before ESC.
        let other = b"\x1b[10;20H\x1b(B\x1b]133;A\x07\x1b\x1b[1mbold";
        assert_eq!(replay_of(&[other]).as_bytes(), other);
        // A CSI far longer than any real one is not held back for ever.
        let endless = [b"\x1b[".as_slice(), &[b'1'; 200], b"m"].concat();
        assert_eq!(replay_of(&[&endless]).as_bytes(), endless);
    }

    const HANDSHAKE: &[u8] = b"\x1b]733;COGNO:CAPS;token=abc;shell=bash;os=linux;\x1b\\";

    #[test]
    fn the_handshake_comes_once_while_it_is_still_in_the_tail() {
        let mut kept = KeptOutput::new();
        kept.push(HANDSHAKE);
        kept.push(b"$ ls\r\n");

        assert_eq!(kept.replay(), [HANDSHAKE, b"$ ls\r\n"].concat());
    }

    #[test]
    fn the_handshake_is_kept_when_it_has_left_the_tail() {
        let mut kept = KeptOutput::with_capacity(16);
        // Split between two reads, like any other sequence may be.
        kept.push(&HANDSHAKE[..10]);
        kept.push(&HANDSHAKE[10..]);
        kept.push(b"a long line of output\nand another one\nlast\n");

        assert_eq!(kept.replay(), [HANDSHAKE, b"last\n"].concat());
    }

    #[test]
    fn the_last_handshake_is_the_one_that_counts() {
        let inner = b"\x1b]733;COGNO:CAPS;token=abc;shell=zsh;os=linux;\x07";
        let mut kept = KeptOutput::with_capacity(16);
        kept.push(HANDSHAKE);
        kept.push(b"$ zsh\n");
        kept.push(inner);
        kept.push(b"a long line of output\nlast\n");

        assert_eq!(kept.replay(), [inner.as_slice(), b"last\n"].concat());
    }

    #[test]
    fn other_operating_system_commands_pass_and_an_endless_one_is_not_held_back() {
        let title = b"\x1b]0;my title\x07after";
        assert_eq!(replay_of(&[title]).as_bytes(), title);
        let endless = [b"\x1b]52;c;".as_slice(), &[b'A'; 6000]].concat();
        assert_eq!(replay_of(&[&endless]).as_bytes(), endless);
    }

    #[test]
    fn the_tail_is_cut_at_a_line_end() {
        let mut kept = KeptOutput::with_capacity(20);
        kept.push(b"first line\nsecond line\nthird line\n");

        // More than fits: the oldest lines go, whole.
        assert_eq!(kept.replay(), b"third line\n");
    }

    #[test]
    fn a_tail_without_a_line_end_still_stays_within_its_size() {
        let mut kept = KeptOutput::with_capacity(10);
        kept.push(&[b'x'; 50]);
        assert!(kept.replay().len() <= 10);
    }
}
