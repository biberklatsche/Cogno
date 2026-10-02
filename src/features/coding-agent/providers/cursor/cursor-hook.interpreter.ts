import { AgentHookEvent } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import {
  compactingActivity,
  describeToolCall,
  firstLine,
  payloadFields,
  stringField,
} from "../_shared/hook-payload";
import { CURSOR_HOOK_EVENT } from "./cursor.config";

/**
 * Reads a Cursor hook: `prompt` on beforeSubmitPrompt, `tool_name`/`tool_input`
 * on the tool hooks, `error_message` on a failed tool call, `trigger` on
 * preCompact and `model` on every hook. Cursor's subagents are not hooked.
 */
export function interpretCursorHook(
  hookEvent: string,
  status: AgentStatus,
  payload: unknown,
): AgentHookEvent {
  const fields = payloadFields(payload);
  const task = firstLine(fields?.["prompt"]);
  const activity =
    firstLine(fields?.["error_message"]) ??
    describeToolCall(fields) ??
    (hookEvent === CURSOR_HOOK_EVENT.preCompact
      ? compactingActivity(fields?.["trigger"])
      : undefined);
  const model = stringField(fields, "model");
  return {
    kind: "status",
    status,
    sessionBoundary:
      hookEvent === CURSOR_HOOK_EVENT.sessionStart || hookEvent === CURSOR_HOOK_EVENT.sessionEnd,
    details: {
      ...(task ? { task } : {}),
      ...(activity ? { activity } : {}),
      ...(model ? { model } : {}),
    },
  };
}
