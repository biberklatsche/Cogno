import { AgentStatus } from "@cogno/core-api";

export type CodexHookEntry = {
  readonly eventName: string;
  readonly status: AgentStatus;
};

export type CodexHookCommand = {
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
    { eventName: "SessionStart", status: "ready" as AgentStatus },
    { eventName: "UserPromptSubmit", status: "working" as AgentStatus },
    { eventName: "SubagentStart", status: "working" as AgentStatus },
    { eventName: "SubagentStop", status: "working" as AgentStatus },
    { eventName: "PreToolUse", status: "working" as AgentStatus },
    { eventName: "PostToolUse", status: "working" as AgentStatus },
    { eventName: "PermissionRequest", status: "question" as AgentStatus },
    { eventName: "PreCompact", status: "working" as AgentStatus },
    { eventName: "PostCompact", status: "working" as AgentStatus },
    { eventName: "Stop", status: "ready" as AgentStatus },
  ] as ReadonlyArray<CodexHookEntry>,

  isCognoCommand(command?: string, commandWindows?: string): boolean {
    const check = (cmd: string) =>
      cmd.includes("COGNO_PORT") && cmd.includes("coding_agent_status");
    return (command ? check(command) : false) || (commandWindows ? check(commandWindows) : false);
  },
} as const;
