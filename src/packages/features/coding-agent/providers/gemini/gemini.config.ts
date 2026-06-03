import { AgentStatus } from "@cogno/core-api";

export type GeminiHookEntry = { readonly eventName: string; readonly status: AgentStatus };

export type GeminiHookCommand = {
  type: "command";
  command: string;
  name?: string;
  timeout?: number;
};

export type GeminiHookGroup = {
  matcher?: string;
  hooks: GeminiHookCommand[];
};

export type GeminiSettings = {
  hooks?: Record<string, GeminiHookGroup[]>;
  [key: string]: unknown;
};

export const GEMINI_CONFIG = {
  id: "gemini",
  name: "Gemini CLI",
  configSubDir: ".gemini",
  configFileName: "settings.json",
  hookEvents: [
    { eventName: "SessionStart",  status: "ready"    as AgentStatus },
    { eventName: "BeforeAgent",   status: "working"  as AgentStatus },
    { eventName: "BeforeModel",   status: "working"  as AgentStatus },
    { eventName: "BeforeTool",    status: "working"  as AgentStatus },
    { eventName: "AfterTool",     status: "working"  as AgentStatus },
    { eventName: "AfterAgent",    status: "ready"    as AgentStatus },
    { eventName: "PreCompress",   status: "working"  as AgentStatus },
    { eventName: "Notification",  status: "question" as AgentStatus },
  ] as ReadonlyArray<GeminiHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("coding_agent_status") && command.includes("COGNO_PORT");
  },
} as const;
