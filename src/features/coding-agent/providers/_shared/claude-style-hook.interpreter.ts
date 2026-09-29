import { AgentHookEvent, HookDetails } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "@cogno/shared/domain";
import { CLAUDE_STYLE_HOOK_EVENT, SESSION_START_SOURCE_COMPACT } from "./hook-events";
import {
  COMPACTED_ACTIVITY,
  compactingActivity,
  describeToolCall,
  EditedFilesReader,
  firstLine,
  PayloadFields,
  payloadFields,
  stringField,
} from "./hook-payload";

/**
 * Reads a hook of the Claude Code protocol (shared by Codex and Kimi CLI) by the
 * fields its payload carries: `prompt` on a submitted prompt, `last_assistant_message`
 * when the agent stopped, `message` on a notification to the user, `error` on a
 * failure, `tool_name`/`tool_input` on a tool call (permission requests included),
 * `trigger` on compaction and `model` where the provider reports it (Claude Code on
 * SessionStart and as `to_model` on PostModelSwitch, Codex on nearly every hook).
 * Which tools edit files differs per provider, so it reads them with `readEditedFiles`.
 */
export function interpretClaudeStyleHook(
  hookEvent: string,
  status: AgentStatus,
  payload: unknown,
  readEditedFiles: EditedFilesReader,
): AgentHookEvent {
  const fields = payloadFields(payload);

  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.subagentStart) {
    return { kind: "subagent", change: "start", agentId: stringField(fields, "agent_id") };
  }
  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.subagentStop) {
    return { kind: "subagent", change: "stop", agentId: stringField(fields, "agent_id") };
  }
  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.postModelSwitch) {
    return { kind: "model", model: stringField(fields, "to_model") };
  }

  return {
    kind: "status",
    status,
    sessionBoundary:
      hookEvent === CLAUDE_STYLE_HOOK_EVENT.sessionEnd ||
      (hookEvent === CLAUDE_STYLE_HOOK_EVENT.sessionStart &&
        stringField(fields, "source") !== SESSION_START_SOURCE_COMPACT),
    details: {
      ...readDetails(hookEvent, fields),
      ...readModel(fields),
      ...readEditedFilesOf(hookEvent, fields, readEditedFiles),
    },
  };
}

function readDetails(hookEvent: string, fields: PayloadFields | undefined): HookDetails {
  const prompt = firstLine(fields?.["prompt"]);
  if (prompt) return isHarnessMessage(prompt) ? {} : { task: prompt };

  const activity =
    firstLine(fields?.["message"]) ??
    firstLine(fields?.["error"]) ??
    describeToolCall(fields) ??
    compactionActivity(hookEvent, fields);
  const result = firstLine(fields?.["last_assistant_message"]);
  return { ...(activity ? { activity } : {}), ...(result ? { result } : {}) };
}

function compactionActivity(
  hookEvent: string,
  fields: PayloadFields | undefined,
): string | undefined {
  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.preCompact)
    return compactingActivity(fields?.["trigger"]);
  if (hookEvent === CLAUDE_STYLE_HOOK_EVENT.postCompact) return COMPACTED_ACTIVITY;
  return undefined;
}

/** A hook fired inside a subagent (it carries `agent_id`) may name the subagent's model. */
function readModel(fields: PayloadFields | undefined): Pick<HookDetails, "model"> {
  const model = stringField(fields, "model");
  return model && !stringField(fields, "agent_id") ? { model } : {};
}

/** Only a finished tool call has changed a file; a failed or pending one has not. */
function readEditedFilesOf(
  hookEvent: string,
  fields: PayloadFields | undefined,
  readEditedFiles: EditedFilesReader,
): Pick<HookDetails, "editedFiles"> {
  if (hookEvent !== CLAUDE_STYLE_HOOK_EVENT.postToolUse) return {};
  const editedFiles = readEditedFiles(fields);
  return editedFiles.length > 0 ? { editedFiles } : {};
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
