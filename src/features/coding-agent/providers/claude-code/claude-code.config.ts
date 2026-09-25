import { AgentStatus } from "@cogno/shared/domain";
import { CODING_AGENT_STATUS_ACTION } from "../_shared/hook-command.builder";
import { CLAUDE_STYLE_HOOK_EVENT } from "../_shared/hook-events";

export type ClaudeHookEntry = {
  readonly eventName: string;
  readonly status: AgentStatus;
  readonly matcher?: string;
};

type ClaudeHookItem = {
  type: "command";
  command: string;
  shell?: "bash" | "powershell";
  timeout?: number;
};

type ClaudeHookGroup = {
  matcher?: string;
  hooks: ClaudeHookItem[];
};

export type ClaudeSettings = {
  hooks?: Record<string, ClaudeHookGroup[]>;
  [key: string]: unknown;
};

export const CLAUDE_CODE_CONFIG = {
  id: "claude-code",
  name: "Claude Code",
  configSubDir: ".claude",
  configFileName: "settings.json",
  hookEvents: [
    { eventName: CLAUDE_STYLE_HOOK_EVENT.userPromptSubmit, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.sessionStart, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.sessionEnd, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.subagentStart, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.subagentStop, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.preToolUse, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postToolUse, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postToolUseFailure, status: "error" as AgentStatus },
    {
      eventName: CLAUDE_STYLE_HOOK_EVENT.notification,
      status: "question" as AgentStatus,
      matcher: "permission_prompt",
    },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.permissionRequest, status: "question" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.permissionDenied, status: "error" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.stop, status: "ready" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.stopFailure, status: "error" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.preCompact, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.postCompact, status: "working" as AgentStatus },
    { eventName: CLAUDE_STYLE_HOOK_EVENT.taskCompleted, status: "working" as AgentStatus },
  ] as ReadonlyArray<ClaudeHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("COGNO_PORT") && command.includes(CODING_AGENT_STATUS_ACTION);
  },
} as const;
