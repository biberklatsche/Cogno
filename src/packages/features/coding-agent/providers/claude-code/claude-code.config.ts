import { AgentStatus } from "@cogno/core-api";

export type ClaudeHookEntry = {
  readonly eventName: string;
  readonly status: AgentStatus;
};

export type ClaudeHookItem = {
  type: "command";
  command: string;
  shell?: "bash" | "powershell";
  timeout?: number;
};

export type ClaudeHookGroup = {
  matcher?: string;
  hooks: ClaudeHookItem[];
};

export type ClaudeSettings = {
  hooks?: Record<string, ClaudeHookGroup[]>;
  [key: string]: unknown;
};

export type CognoManifest = {
  installedAt: string;
};

export const CLAUDE_CODE_CONFIG = {
  id: "claude-code",
  name: "Claude Code",
  configSubDir: ".claude",
  configFileName: "settings.json",
  manifestFileName: "cogno-hooks.json",
  hookEvents: [
    { eventName: "UserPromptSubmit", status: "working" as AgentStatus },
    { eventName: "SessionStart", status: "ready" as AgentStatus },
    { eventName: "SessionEnd", status: "error" as AgentStatus },
    { eventName: "SubagentStart", status: "working" as AgentStatus },
    { eventName: "SubagentStop", status: "working" as AgentStatus },
    { eventName: "PreToolUse", status: "working" as AgentStatus },
    { eventName: "PostToolUse", status: "working" as AgentStatus },
    { eventName: "PostToolUseFailure", status: "error" as AgentStatus },
    { eventName: "Notification", status: "question" as AgentStatus },
    { eventName: "PermissionRequest", status: "question" as AgentStatus },
    { eventName: "PermissionDenied", status: "error" as AgentStatus },
    { eventName: "Stop", status: "ready" as AgentStatus },
    { eventName: "StopFailure", status: "error" as AgentStatus },
    { eventName: "PreCompact", status: "working" as AgentStatus },
    { eventName: "PostCompact", status: "working" as AgentStatus },
  ] as ReadonlyArray<ClaudeHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("COGNO_PORT") && command.includes("coding_agent_status");
  },
} as const;
