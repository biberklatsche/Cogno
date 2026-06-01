import { AgentStatus } from "@cogno/core-api";

export type KimiHookEntry = { readonly eventName: string; readonly status: AgentStatus };

// Kimi uses TOML config: [[hooks]] array with event + command fields
// Verify against: https://github.com/MoonshotAI/kimi-coder — schema may change
export type KimiHook = { event: string; command: string; [key: string]: unknown };
export type KimiConfig = { hooks?: KimiHook[]; [key: string]: unknown };

export const KIMI_CONFIG = {
  id: "kimi",
  name: "Kimi CLI",
  processNames: ["kimi"],
  resumeLinkPattern: undefined,
  configSubDir: ".kimi",
  configFileName: "config.toml",
  manifestFileName: "cogno-hooks.json",
  hookEvents: [
    { eventName: "PreToolUse", status: "working" as AgentStatus },
    { eventName: "Stop", status: "ready" as AgentStatus },
    { eventName: "Notification", status: "question" as AgentStatus },
    { eventName: "StopFailure", status: "error" as AgentStatus },
  ] as ReadonlyArray<KimiHookEntry>,
  isCognoCommand(command: string): boolean {
    return command.includes("coding_agent_status") && command.includes("COGNO_PORT");
  },
} as const;
