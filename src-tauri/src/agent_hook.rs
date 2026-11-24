//! `cogno hook <provider> <event>`: what a coding agent's hook runs (the
//! scripts of `features/coding-agent`, OpenCode's plugin). It hands the
//! agent's payload on stdin to the host of this machine, which passes it on
//! to the Cogno that shows the terminal the hook ran in - on this machine or
//! another (ARCHITECTURE.md 3.2). It never fails the agent: whatever goes
//! wrong, it exits 0 and says nothing.

use std::io::{self, IsTerminal, Read};
use std::time::{SystemTime, UNIX_EPOCH};

use cogno_host::env_vars::COGNO_TERMINAL_ID;
use cogno_host::protocol::{AgentHook, Request};

use crate::host_endpoint::host_endpoint;

/// A payload larger than this goes as a marker that says so: the host keeps
/// what it hands on, and an agent's tool output can be large.
const PAYLOAD_MAX_BYTES: usize = 1024 * 1024;

/// Sends the hook; the process exit code, always 0.
pub fn send(provider: String, event: String) -> i32 {
    let hook = AgentHook {
        terminal_id: std::env::var(COGNO_TERMINAL_ID)
            .ok()
            .filter(|id| !id.is_empty()),
        provider,
        event,
        sent_at: now_millis(),
        payload: payload_from_stdin(),
    };
    if let Ok(endpoint) = host_endpoint() {
        // No host runs, or it does not answer: there is nobody to tell.
        let _ = cogno_host::once::post(&endpoint, Request::AgentHook { hook });
    }
    0
}

/// The payload of what the agent wrote, unless stdin is the console: an
/// inherited console never ends and would hold the hook (and the agent) for
/// ever.
fn payload_from_stdin() -> String {
    let stdin = io::stdin();
    if stdin.is_terminal() {
        return payload_of(io::empty());
    }
    payload_of(stdin.lock())
}

/// The payload as JSON text: what the agent wrote when it is JSON, else a
/// JSON string that says why not. Never holds more than the limit: the rest
/// of a larger one is only counted, and read so the agent is not left
/// writing into a pipe nobody empties.
fn payload_of(written: impl Read) -> String {
    let mut written = written.take(PAYLOAD_MAX_BYTES as u64 + 1);
    let mut bytes = Vec::new();
    let _ = written.read_to_end(&mut bytes);
    if bytes.len() > PAYLOAD_MAX_BYTES {
        let rest = io::copy(&mut written.into_inner(), &mut io::sink()).unwrap_or(0);
        return format!("\"omitted:too-large:{}\"", bytes.len() as u64 + rest);
    }
    let text = String::from_utf8_lossy(&bytes);
    let trimmed = text.trim();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        trimmed.to_string()
    } else {
        "\"omitted:not-json\"".to_string()
    }
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_payload_is_handed_on_when_it_is_json_and_named_when_not() {
        assert_eq!(payload_of(&b" {\"a\":1}\n"[..]), "{\"a\":1}");
        assert_eq!(payload_of(&b"[1]"[..]), "[1]");
        assert_eq!(payload_of(&b"hello"[..]), "\"omitted:not-json\"");
        assert_eq!(payload_of(io::empty()), "\"omitted:not-json\"");
    }

    #[test]
    fn a_payload_over_the_limit_is_counted_to_its_end_and_not_held() {
        let large = vec![b'{'; PAYLOAD_MAX_BYTES + 10];
        let mut written = &large[..];

        let payload = payload_of(&mut written);

        assert_eq!(
            payload,
            format!("\"omitted:too-large:{}\"", PAYLOAD_MAX_BYTES + 10)
        );
        assert!(written.is_empty(), "read to its end");
    }
}
