import { AgentStatus } from "@cogno/core-api";

export type KimiHookEntry = { readonly eventName: string; readonly status: AgentStatus };

export type KimiHook = {
  event: string;
  command: string;
  matcher?: string;
  timeout?: number;
  [key: string]: unknown;
};
export type KimiConfig = { hooks?: KimiHook[]; [key: string]: unknown };

export const KIMI_CONFIG = {
  id: "kimi",
  name: "Kimi CLI",
  configSubDir: ".kimi",
  configFileName: "config.toml",
  hookEvents: [
    { eventName: "SessionStart", status: "ready" as AgentStatus },
    { eventName: "UserPromptSubmit", status: "working" as AgentStatus },
    { eventName: "SubagentStart", status: "working" as AgentStatus },
    { eventName: "SubagentStop", status: "working" as AgentStatus },
    { eventName: "PreToolUse", status: "working" as AgentStatus },
    { eventName: "PostToolUse", status: "working" as AgentStatus },
    { eventName: "PostToolUseFailure", status: "error" as AgentStatus },
    { eventName: "PreCompact", status: "working" as AgentStatus },
    { eventName: "PostCompact", status: "working" as AgentStatus },
    { eventName: "Notification", status: "question" as AgentStatus },
    { eventName: "Stop", status: "ready" as AgentStatus },
    { eventName: "StopFailure", status: "error" as AgentStatus },
  ] as ReadonlyArray<KimiHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("coding_agent_status") && command.includes("COGNO_PORT");
  },
} as const;
