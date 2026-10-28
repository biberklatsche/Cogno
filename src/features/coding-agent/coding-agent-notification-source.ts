import { NotificationSourceContract } from "@cogno/core/api/contributions";
import { AgentStatus } from "./agent-status";

export const CODING_AGENT_NOTIFICATION_SOURCE_ID = "coding_agents";

/** One event per agent status; the event id is the status. */
export const CODING_AGENT_NOTIFICATION_SOURCE: NotificationSourceContract = {
  id: CODING_AGENT_NOTIFICATION_SOURCE_ID,
  label: "Coding agents",
  events: [
    {
      id: "working" satisfies AgentStatus,
      label: "Agent starts working",
      description: "Notify when an agent starts working.",
    },
    {
      id: "question" satisfies AgentStatus,
      label: "Agent has a question",
      description: "Notify when an agent has a question and needs input.",
    },
    {
      id: "ready" satisfies AgentStatus,
      label: "Agent becomes ready",
      description: "Notify when an agent becomes ready/idle.",
    },
    {
      id: "error" satisfies AgentStatus,
      label: "Agent reports an error",
      description: "Notify when an agent reports an error.",
    },
  ],
};
