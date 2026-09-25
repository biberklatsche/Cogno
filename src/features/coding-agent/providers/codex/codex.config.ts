import { AgentStatus } from "@cogno/shared/domain";
import { CODING_AGENT_STATUS_ACTION } from "../_shared/hook-command.builder";
import { CLAUDE_STYLE_HOOK_EVENT } from "../_shared/hook-events";

export type CodexHookEntry = {
  readonly eventName: string;
  readonly status: AgentStatus;
};

type CodexHookCommand = {
  type: "command";
  command: string;
  commandWindows?: string;
  timeout?: number;
};

export type CodexHookGroup = {
  matcher?: string;
  hooks: CodexHookCommand[];
};

export type CodexHooksFile = {
  hooks?: Record<string, CodexHookGroup[]>;
};

export const CODEX_CONFIG = {
  id: "codex",
  name: "Codex",
  configSubDir: ".codex",
  configFileName: "hooks.json",
  appConfigFileName: "config.toml",
  hookEvents: [
    { eventName: CLAUDE_STYLE_HOOK_EVENT.sessionStart, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.userPromptSubmit, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.subagentStart, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.subagentStop, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.preToolUse, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postToolUse, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.permissionRequest, status: "question" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.preCompact, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postCompact, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.stop, status: "ready" as AgentStatus },
  ] as ReadonlyArray<CodexHookEntry>,

  isCognoCommand(command?: string, commandWindows?: string): boolean {
    const check = (cmd: string) =>
      cmd.includes("COGNO_PORT") && cmd.includes(CODING_AGENT_STATUS_ACTION);
    return (command ? check(command) : false) || (commandWindows ? check(commandWindows) : false);
  },
} as const;
