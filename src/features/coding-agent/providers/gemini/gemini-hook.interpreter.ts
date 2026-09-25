import { AgentHookEvent } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "@cogno/shared/domain";
import { describeToolCall, firstLine, payloadFields } from "../_shared/hook-payload";
import { GEMINI_HOOK_EVENT } from "./gemini.config";

/**
 * Reads a Gemini CLI hook: `prompt` on BeforeAgent, `tool_name`/`tool_input` on the
 * tool hooks, `message` on a notification and `prompt_response` on AfterAgent.
 * Gemini CLI has no subagent hooks.
 */
export function interpretGeminiHook(
  hookEvent: string,
  status: AgentStatus,
  payload: unknown,
): AgentHookEvent {
  const fields = payloadFields(payload);
  const task = firstLine(fields?.["prompt"]);
  const activity = firstLine(fields?.["message"]) ?? describeToolCall(fields);
  const result = firstLine(fields?.["prompt_response"]);
  return {
    kind: "status",
    status,
    sessionBoundary: hookEvent === GEMINI_HOOK_EVENT.sessionStart,
    details: {
      ...(task ? { task } : {}),
      ...(activity ? { activity } : {}),
      ...(result ? { result } : {}),
    },
  };
}
