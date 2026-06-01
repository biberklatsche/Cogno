import { AgentStatus } from "@cogno/core-api";

export type GeminiHookEntry = { readonly eventName: string; readonly status: AgentStatus };

// Gemini: matcher + command directly in hook group (no nested hooks array)
// Verify against: https://github.com/google-gemini/gemini-cli — schema may change
export type GeminiHookGroup = { matcher?: string; command: string };
export type GeminiSettings = {
  hooks?: Record<string, GeminiHookGroup[]>;
  [key: string]: unknown;
};

export const GEMINI_CONFIG = {
  id: "gemini",
  name: "Gemini CLI",
  processNames: ["gemini"],
  resumeLinkPattern: undefined,
  configSubDir: ".gemini",
  configFileName: "settings.json",
  manifestFileName: "cogno-hooks.json",
  hookEvents: [
    { eventName: "BeforeAgent", status: "working" as AgentStatus },
    { eventName: "AfterAgent", status: "ready" as AgentStatus },
    { eventName: "Notification", status: "question" as AgentStatus },
  ] as ReadonlyArray<GeminiHookEntry>,
  isCognoCommand(command: string): boolean {
    return command.includes("coding_agent_status") && command.includes("COGNO_PORT");
  },
} as const;
