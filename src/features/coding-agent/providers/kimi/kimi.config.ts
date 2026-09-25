import { AgentStatus } from "@cogno/shared/domain";
import { CODING_AGENT_STATUS_ACTION } from "../_shared/hook-command.builder";
import { CLAUDE_STYLE_HOOK_EVENT } from "../_shared/hook-events";

export type KimiHookEntry = { readonly eventName: string; readonly status: AgentStatus };

type KimiHook = {
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
    { eventName: CLAUDE_STYLE_HOOK_EVENT.sessionStart, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.userPromptSubmit, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.subagentStart, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.subagentStop, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.preToolUse, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postToolUse, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postToolUseFailure, status: "error" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.preCompact, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postCompact, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.notification, status: "question" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.stop, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.stopFailure, status: "error" as AgentStatus },
  ] as ReadonlyArray<KimiHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes(CODING_AGENT_STATUS_ACTION) && command.includes("COGNO_PORT");
  },
} as const;
