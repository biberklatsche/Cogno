import { AnimationSpec } from "@cogno/core/api/terminal-animation-port";
import { AgentStatus } from "./agent-status";

export const AGENT_STATUS_REGISTRATION_KEY = "coding-agent-status";

/** The face for each agent status, on the busy indicator and in the agent list. */
export const AGENT_STATUS_SPECS = {
  ready: { indicator: { motif: "face", mood: "calm" }, priority: 25 },
  working: { indicator: { motif: "face", mood: "busy" }, priority: 50 },
  question: { indicator: { motif: "face", mood: "asking" }, priority: 75 },
  error: { indicator: { motif: "face", mood: "failed" }, priority: 100 },
} satisfies Record<AgentStatus, AnimationSpec>;
