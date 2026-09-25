import { AgentHookEvent, HookDetails } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "@cogno/shared/domain";
import { CLAUDE_STYLE_HOOK_EVENT, SESSION_START_SOURCE_COMPACT } from "./hook-events";
import { describeToolCall, firstLine, payloadFields, stringField } from "./hook-payload";

/**
 * Reads a hook of the Claude Code protocol (shared by Codex and Kimi CLI) by the
 * fields its payload carries: `prompt` on a submitted prompt, `last_assistant_message`
 * when the agent stopped, `message` on a notification to the user, `error` on a
 * failure, `tool_name`/`tool_input` on a tool call (permission requests included).
 */
export function interpretClaudeStyleHook(
  hookEvent: string,
  status: AgentStatus,
  payload: unknown,
): AgentHookEvent {
  const fields = payloadFields(payload);

  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.subagentStart) {
    return { kind: "subagent", change: "start", agentId: stringField(fields, "agent_id") };
  }
  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.subagentStop) {
    return { kind: "subagent", change: "stop", agentId: stringField(fields, "agent_id") };
  }

  return {
    kind: "status",
    status,
    sessionBoundary:
      hookEvent === CLAUDE_STYLE_HOOK_EVENT.sessionEnd ||
      (hookEvent === CLAUDE_STYLE_HOOK_EVENT.sessionStart &&
        stringField(fields, "source") !== SESSION_START_SOURCE_COMPACT),
    details: readDetails(fields),
  };
}

function readDetails(fields: ReturnType<typeof payloadFields>): HookDetails {
  const prompt = firstLine(fields?.["prompt"]);
  if (prompt) return isHarnessMessage(prompt) ? {} : { task: prompt };

  const activity =
    firstLine(fields?.["message"]) ?? firstLine(fields?.["error"]) ?? describeToolCall(fields);
  const result = firstLine(fields?.["last_assistant_message"]);
  return { ...(activity ? { activity } : {}), ...(result ? { result } : {}) };
}

/**
 * Claude Code submits its own messages as prompts too: a finished background task
 * arrives as `<task-notification>…`, a subagent's reply as `<agent-message from="…">…`.
 * A first line that is nothing but an opening tag marks such a message; it is not
 * the user's task, so it changes nothing.
 */
function isHarnessMessage(promptFirstLine: string): boolean {
  return /^<[\w-]+(\s[^<>]*)?>$/.test(promptFirstLine);
}
