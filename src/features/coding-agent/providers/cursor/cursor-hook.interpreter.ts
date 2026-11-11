import { AgentHookEvent } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import {
  compactingActivity,
  describeToolCall,
  firstLine,
  payloadFields,
  stringField,
} from "../_shared/hook-payload";
import { HookSession } from "../_shared/hook-transport";
import { CURSOR_HOOK_EVENT } from "./cursor.config";

/** Cursor names the session `conversation_id` and the folder in `workspace_roots`. */
export function cursorSession(payload: unknown): HookSession {
  const fields = payloadFields(payload);
  const roots = fields?.["workspace_roots"];
  const cwd = Array.isArray(roots) && typeof roots[0] === "string" ? roots[0] : undefined;
  return { sessionId: stringField(fields, "conversation_id"), cwd };
}

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
