import { AgentHookEvent } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "@cogno/shared/domain";
import {
  compactingActivity,
  describeToolCall,
  editedFilesByTool,
  firstLine,
  PayloadFields,
  payloadFields,
  stringField,
} from "../_shared/hook-payload";
import { GEMINI_CONFIG, GEMINI_HOOK_EVENT } from "./gemini.config";

const readEditedFiles = editedFilesByTool(GEMINI_CONFIG.editTools);

/**
 * Reads a Gemini CLI hook: `prompt` on BeforeAgent, `tool_name`/`tool_input` on the
 * tool hooks, `message` on a notification, `prompt_response` on AfterAgent,
 * `llm_request.model` on BeforeModel and `trigger` on PreCompress.
 * Gemini CLI has no subagent hooks.
 */
export function interpretGeminiHook(
  hookEvent: string,
  status: AgentStatus,
  payload: unknown,
): AgentHookEvent {
  const fields = payloadFields(payload);
  const task = firstLine(fields?.["prompt"]);
  const activity =
    firstLine(fields?.["message"]) ??
    describeToolCall(fields) ??
    (hookEvent === GEMINI_HOOK_EVENT.preCompress
      ? compactingActivity(fields?.["trigger"])
      : undefined);
  const result = firstLine(fields?.["prompt_response"]);
  const model = stringField(objectField(fields, "llm_request"), "model");
  const editedFiles =
    hookEvent === GEMINI_HOOK_EVENT.afterTool && !objectField(fields, "tool_response")?.["error"]
      ? readEditedFiles(fields)
      : [];
  return {
    kind: "status",
    status,
    sessionBoundary: hookEvent === GEMINI_HOOK_EVENT.sessionStart,
    details: {
      ...(task ? { task } : {}),
      ...(activity ? { activity } : {}),
      ...(result ? { result } : {}),
      ...(model ? { model } : {}),
      ...(editedFiles.length > 0 ? { editedFiles } : {}),
    },
  };
}

function objectField(fields: PayloadFields | undefined, key: string): PayloadFields | undefined {
  const value = fields?.[key];
  return value && typeof value === "object" ? (value as PayloadFields) : undefined;
}
