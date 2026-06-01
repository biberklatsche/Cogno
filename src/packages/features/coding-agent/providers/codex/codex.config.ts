import { AgentStatus } from "@cogno/core-api";

export type CodexHookEntry = {
  readonly eventName: string;
  readonly status: AgentStatus;
};

// Codex hooks.json format: flat object mapping event name to command descriptor
// Verify against: https://github.com/openai/codex — schema may change
export type CodexHooks = {
  [eventName: string]: { type: "command"; command: string };
};

export const CODEX_CONFIG = {
  id: "codex",
  name: "Codex",
  processNames: ["codex"],
  resumeLinkPattern: undefined,
  configSubDir: ".codex",
  configFileName: "hooks.json",
  manifestFileName: "cogno-hooks.json",
  hookEvents: [
    { eventName: "UserPromptSubmit", status: "working" as AgentStatus },
    { eventName: "Stop", status: "ready" as AgentStatus },
  ] as ReadonlyArray<CodexHookEntry>,

  isCognoCommand(command: string): boolean {
    return command.includes("coding_agent_status") && command.includes("COGNO_PORT");
  },
} as const;
