import { AgentStatus } from "../../agent-status";
import { CODING_AGENT_STATUS_ACTION } from "../_shared/hook-command.builder";

export type CursorHookEntry = { readonly eventName: string; readonly status: AgentStatus };

type CursorHook = {
  command: string;
  type?: "command" | "prompt";
  matcher?: string;
  timeout?: number;
  [key: string]: unknown;
};

/** `~/.cursor/hooks.json`: a flat list of hooks per event, no matcher groups. */
export type CursorHooksFile = {
  version?: number;
  hooks?: Record<string, CursorHook[]>;
  [key: string]: unknown;
};

/** Cursor's hook event names. */
export const CURSOR_HOOK_EVENT = {
  sessionStart: "sessionStart",
  sessionEnd: "sessionEnd",
  beforeSubmitPrompt: "beforeSubmitPrompt",
  postToolUse: "postToolUse",
  postToolUseFailure: "postToolUseFailure",
  preCompact: "preCompact",
  stop: "stop",
} as const;

export const CURSOR_CONFIG = {
  id: "cursor",
  name: "Cursor",
  configSubDir: ".cursor",
  configFileName: "hooks.json",
  fileVersion: 1,
  // Only observing events are hooked. Cursor's permission hooks (preToolUse,
  // beforeShellExecution, beforeMCPExecution, beforeReadFile, subagentStart)
  // read a decision from stdout; a status reporter must not take part in that.
  // Without subagentStart, subagents cannot be told apart, so subagentStop is
  // not hooked either. Cursor has no event for "waiting for the user", so
  // `question` never occurs.
  hookEvents: [
    { eventName: CURSOR_HOOK_EVENT.sessionStart, status: "ready" as AgentStatus },
    { eventName: CURSOR_HOOK_EVENT.sessionEnd, status: "ready" as AgentStatus },
    { eventName: CURSOR_HOOK_EVENT.beforeSubmitPrompt, status: "working" as AgentStatus },
    { eventName: CURSOR_HOOK_EVENT.postToolUse, status: "working" as AgentStatus },
    { eventName: CURSOR_HOOK_EVENT.postToolUseFailure, status: "error" as AgentStatus },
    { eventName: CURSOR_HOOK_EVENT.preCompact, status: "working" as AgentStatus },
    { eventName: CURSOR_HOOK_EVENT.stop, status: "ready" as AgentStatus },
  ] as ReadonlyArray<CursorHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes(CODING_AGENT_STATUS_ACTION) && command.includes("COGNO_PORT");
  },
} as const;
