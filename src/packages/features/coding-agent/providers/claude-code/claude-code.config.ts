import { AgentStatus } from "@cogno/core-api";

export type ClaudeHookEntry = {
  readonly eventName: string;
  readonly status: AgentStatus;
};

export type ClaudeHookItem = {
  type: "command";
  command: string;
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
  // Covers Claude Code and its forks — all read from ~/.claude/settings.json
  processNames: ["claude", "qoder", "qwen-code", "factory", "codebuddy"],
  resumeLinkPattern: /\b([a-zA-Z][\w-]*)\s+(resume|--resume|-r)\s+([a-zA-Z0-9][a-zA-Z0-9_-]{7,})/gi
    .source,
  configSubDir: ".claude",
  configFileName: "settings.json",
  manifestFileName: "cogno-hooks.json",
  hookEvents: [
    { eventName: "PreToolUse", status: "working" as AgentStatus },
    { eventName: "Stop", status: "ready" as AgentStatus },
    { eventName: "Notification", status: "question" as AgentStatus },
    { eventName: "PermissionRequest", status: "question" as AgentStatus },
    { eventName: "StopFailure", status: "error" as AgentStatus },
  ] as ReadonlyArray<ClaudeHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("coding_agent_status") && command.includes("COGNO_PORT");
  },
} as const;
