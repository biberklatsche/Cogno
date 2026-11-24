//! What processes say to Cogno, as the webview receives it
//! (`cogno-message`, `platform/cogno-message.ts`): today the hooks of coding
//! agents, which reach this app through the host of the machine they run on.

use cogno_host::protocol::AgentHook;
use serde::Serialize;

/// The webview event a message arrives as.
pub const COGNO_MESSAGE_EVENT: &str = "cogno-message";
/// The command a coding agent's hook arrives under.
const CODING_AGENT_HOOK_COMMAND: &str = "coding_agent_hook";
/// The fourth argument of a hook the host played back.
const REPLAYED: &str = "replayed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CognoMessage {
    pub command: String,
    pub args: Vec<String>,
    pub terminal_id: Option<String>,
    /// The agent's payload, parsed; the webview's adapters read it.
    pub payload: serde_json::Value,
}

impl CognoMessage {
    /// A coding agent's hook: `[provider, sentAt, event, replayed?]`.
    pub fn of_agent_hook(hook: AgentHook, replayed: bool) -> Self {
        let mut args = vec![hook.provider, hook.sent_at.to_string(), hook.event];
        if replayed {
            args.push(REPLAYED.to_string());
        }
        Self {
            command: CODING_AGENT_HOOK_COMMAND.to_string(),
            args,
            terminal_id: hook.terminal_id,
            payload: serde_json::from_str(&hook.payload).unwrap_or(serde_json::Value::Null),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hook_reaches_the_webview_as_the_adapters_read_it() {
        let hook = AgentHook {
            terminal_id: Some("t1".into()),
            provider: "codex".into(),
            event: "Stop".into(),
            sent_at: 1_700_000_000_123,
            payload: r#"{"session_id":"s1"}"#.into(),
        };

        // The webview's side reads the same file (`hook-transport.spec.ts`).
        let contract: serde_json::Value = serde_json::from_str(include_str!(
            "../../src/features/coding-agent/providers/_shared/hook-message.contract.json"
        ))
        .unwrap();
        assert_eq!(
            serde_json::to_value(CognoMessage::of_agent_hook(hook, true)).unwrap(),
            contract
        );
    }
}
