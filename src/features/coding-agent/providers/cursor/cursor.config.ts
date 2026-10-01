import { AgentStatus } from "@cogno/shared/domain";

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

export const CURSOR_CONFIG = {
  id: "cursor",
  name: "Cursor",
  configSubDir: ".cursor",
  configFileName: "hooks.json",
  fileVersion: 1,
  // Only observing events are hooked. Cursor's permission hooks (preToolUse,
  // beforeShellExecution, beforeMCPExecution, beforeReadFile, subagentStart)
  // read a decision from stdout; a status reporter must not take part in that.
  // Cursor has no event for "waiting for the user", so `question` never occurs.
  hookEvents: [
    { eventName: "sessionStart", status: "ready" as AgentStatus },
    { eventName: "sessionEnd", status: "ready" as AgentStatus },
    { eventName: "beforeSubmitPrompt", status: "working" as AgentStatus },
    { eventName: "postToolUse", status: "working" as AgentStatus },
    { eventName: "postToolUseFailure", status: "error" as AgentStatus },
    { eventName: "subagentStop", status: "ready" as AgentStatus },
    { eventName: "preCompact", status: "working" as AgentStatus },
    { eventName: "stop", status: "ready" as AgentStatus },
  ] as ReadonlyArray<CursorHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("COGNO_PORT") && command.includes("coding_agent_status");
  },
} as const;
