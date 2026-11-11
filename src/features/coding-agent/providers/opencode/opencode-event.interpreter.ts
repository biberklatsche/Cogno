import { AgentHookEvent, HookDetails } from "@cogno/features/coding-agent/ports";
import { AgentStatus } from "../../agent-status";
import {
  describeToolCall,
  firstLine,
  PayloadFields,
  payloadFields,
  stringField,
} from "../_shared/hook-payload";
import { HookSession } from "../_shared/hook-transport";
import { OPENCODE_EVENT } from "./opencode.config";

/** A subagent's session is over when its run ends, however it ends. */
const EXECUTION_ENDED = new Set<string>([
  OPENCODE_EVENT.succeeded,
  OPENCODE_EVENT.failed,
  OPENCODE_EVENT.interrupted,
]);

/**
 * The session an OpenCode message belongs to. A subagent runs as a child
 * session with `parent_id`: its events count for the parent, the card.
 */
export function openCodeSession(payload: unknown): HookSession {
  const fields = payloadFields(payload);
  return {
    sessionId: stringField(fields, "parent_id") ?? stringField(fields, "session_id"),
    cwd: stringField(fields, "directory"),
  };
}

/**
 * Reads one message of Cogno's OpenCode plugin. A child session is a
 * subagent: it starts when created and stops when its run ends; what it does
 * in between says nothing about the main agent.
 */
export function interpretOpenCodeEvent(
  hookEvent: string,
  status: AgentStatus,
  payload: unknown,
): AgentHookEvent | undefined {
  const fields = payloadFields(payload);
  const childId = stringField(fields, "parent_id") ? stringField(fields, "session_id") : undefined;
  if (childId) {
    if (hookEvent === OPENCODE_EVENT.created)
      return { kind: "subagent", change: "start", agentId: childId };
    if (EXECUTION_ENDED.has(hookEvent))
      return { kind: "subagent", change: "stop", agentId: childId };
    return undefined;
  }
  return {
    kind: "status",
    status,
    sessionBoundary: hookEvent === OPENCODE_EVENT.created,
    details: readDetails(hookEvent, fields),
  };
}

function readDetails(hookEvent: string, fields: PayloadFields | undefined): HookDetails {
  const task = hookEvent === OPENCODE_EVENT.prompt ? firstLine(fields?.["prompt"]) : undefined;
  const activity = readActivity(hookEvent, fields);
  const model = readModel(fields?.["model"]);
  return {
    ...(task ? { task } : {}),
    ...(activity ? { activity } : {}),
    ...(model ? { model } : {}),
  };
}

function readActivity(hookEvent: string, fields: PayloadFields | undefined): string | undefined {
  if (hookEvent === OPENCODE_EVENT.tool) return describeToolCall(fields);
  if (hookEvent === OPENCODE_EVENT.permissionAsked) {
    const what = firstLine(fields?.["message"]) ?? stringField(fields, "action");
    return what ? `Permission: ${what}` : "Permission requested";
  }
  if (hookEvent === OPENCODE_EVENT.failed) {
    const error = fields?.["error"];
    const message =
      error && typeof error === "object"
        ? firstLine((error as PayloadFields)["message"] ?? (error as PayloadFields)["name"])
        : firstLine(error);
    return message ?? "Run failed";
  }
  return undefined;
}

/** `session.created` names the model as `{providerID, modelID}`. */
function readModel(model: unknown): string | undefined {
  if (!model || typeof model !== "object") return undefined;
  return stringField(model as PayloadFields, "modelID");
}
