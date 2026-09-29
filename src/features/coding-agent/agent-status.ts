export type AgentStatus = "working" | "question" | "error" | "ready";

export function parseAgentStatus(raw: string | undefined): AgentStatus | undefined {
  if (raw === "working" || raw === "question" || raw === "error" || raw === "ready") {
    return raw;
  }
  return undefined;
}
