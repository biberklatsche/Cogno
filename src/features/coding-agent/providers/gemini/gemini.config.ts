import { AgentStatus } from "@cogno/shared/domain";
import { CODING_AGENT_STATUS_ACTION } from "../_shared/hook-command.builder";

export type GeminiHookEntry = { readonly eventName: string; readonly status: AgentStatus };

type GeminiHookCommand = {
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

/** Gemini CLI's hook event names. */
export const GEMINI_HOOK_EVENT = {
  sessionStart: "SessionStart",
  beforeAgent: "BeforeAgent",
  beforeModel: "BeforeModel",
  beforeTool: "BeforeTool",
  afterTool: "AfterTool",
  afterAgent: "AfterAgent",
  preCompress: "PreCompress",
  notification: "Notification",
} as const;

export const GEMINI_CONFIG = {
  id: "gemini",
  name: "Gemini CLI",
  configSubDir: ".gemini",
  configFileName: "settings.json",
  hookEvents: [
    { eventName: GEMINI_HOOK_EVENT.sessionStart, status: "ready" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.beforeAgent, status: "working" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.beforeModel, status: "working" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.beforeTool, status: "working" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.afterTool, status: "working" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.afterAgent, status: "ready" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.preCompress, status: "working" as AgentStatus },
    { eventName: GEMINI_HOOK_EVENT.notification, status: "question" as AgentStatus },
  ] as ReadonlyArray<GeminiHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes(CODING_AGENT_STATUS_ACTION) && command.includes("COGNO_PORT");
  },
} as const;
