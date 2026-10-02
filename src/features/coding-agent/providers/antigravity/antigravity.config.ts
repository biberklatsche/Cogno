import { AgentStatus } from "../../agent-status";

type AntigravityHookHandler = {
  type?: "command";
  command: string;
  timeout?: number;
};

type AntigravityHookGroup = {
  matcher?: string;
  hooks: AntigravityHookHandler[];
};

export type AntigravityHookDefinition = {
  PostToolUse?: AntigravityHookGroup[];
  PreInvocation?: AntigravityHookHandler[];
  PostInvocation?: AntigravityHookHandler[];
  Stop?: AntigravityHookHandler[];
};

export type AntigravityHooksFile = Record<string, AntigravityHookDefinition>;

/** PostToolUse entries are matcher+hooks groups; the lifecycle events are plain handler lists. */
type AntigravityToolHookEntry = {
  readonly kind: "tool";
  readonly eventName: "PostToolUse";
  readonly status: AgentStatus;
  readonly matcher: string;
  /** JSON the hook must print to stdout to satisfy Antigravity's hook contract. */
  readonly stdout: string;
};

type AntigravityLifecycleHookEntry = {
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
} as const;
