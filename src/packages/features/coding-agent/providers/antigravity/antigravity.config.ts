import { AgentStatus } from "@cogno/core-api";

export type AntigravityHookHandler = {
  type?: "command";
  command: string;
  timeout?: number;
};

export type AntigravityHookGroup = {
  matcher?: string;
  hooks: AntigravityHookHandler[];
};

export type AntigravityHookDefinition = {
  enabled?: boolean;
  PreToolUse?: AntigravityHookGroup[];
  PostToolUse?: AntigravityHookGroup[];
  PreInvocation?: AntigravityHookHandler[];
  PostInvocation?: AntigravityHookHandler[];
  Stop?: AntigravityHookHandler[];
};

export type AntigravityHooksFile = Record<string, AntigravityHookDefinition>;

/** PreToolUse/PostToolUse entries are matcher+hooks groups; the other lifecycle events are plain handler lists. */
export type AntigravityToolHookEntry = {
  readonly kind: "tool";
  readonly eventName: "PreToolUse" | "PostToolUse";
  readonly status: AgentStatus;
  readonly matcher: string;
  /** JSON the hook must print to stdout to satisfy Antigravity's hook contract. */
  readonly stdout: string;
};

export type AntigravityLifecycleHookEntry = {
  readonly kind: "lifecycle";
  readonly eventName: "PreInvocation" | "PostInvocation" | "Stop";
  readonly status: AgentStatus;
  /** JSON the hook must print to stdout to satisfy Antigravity's hook contract. */
  readonly stdout: string;
};

export type AntigravityHookEntry = AntigravityToolHookEntry | AntigravityLifecycleHookEntry;

export const ANTIGRAVITY_CONFIG = {
  id: "antigravity",
  name: "Antigravity",
  configSubDir: ".gemini/config",
  configFileName: "hooks.json",
  hookName: "cogno-status",
  // PreToolUse is intentionally not hooked: its "decision" output would override Antigravity's
  // own permission flow, which is a side effect a status reporter must not introduce.
  hookEvents: [
    {
      kind: "tool",
      eventName: "PostToolUse",
      status: "working",
      matcher: "*",
      stdout: "{}",
    },
    {
      kind: "lifecycle",
      eventName: "PreInvocation",
      status: "working",
      stdout: "{}",
    },
    {
      kind: "lifecycle",
      eventName: "PostInvocation",
      status: "working",
      stdout: "{}",
    },
    {
      kind: "lifecycle",
      eventName: "Stop",
      status: "ready",
      // Any value other than "continue" lets the agent stop normally.
      stdout: '{"decision":""}',
    },
  ] as ReadonlyArray<AntigravityHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("COGNO_PORT") && command.includes("coding_agent_status");
  },
} as const;
