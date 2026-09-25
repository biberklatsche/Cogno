import { describe, expect, it } from "vitest";
import { groupAgentsByWorkspace } from "./agent-groups";
import type { ActiveAgent } from "./coding-agent-status.service";

function agent(terminalId: string, placement?: ActiveAgent["placement"]): ActiveAgent {
  return {
    terminalId,
    providerId: "claude-code",
    providerName: "Claude Code",
    status: "working",
    statusSince: 0,
    subagentCount: 0,
    placement,
  };
}

function placed(workspaceId: string, workspacePosition: number, tabIndex: number) {
  return {
    workspaceId,
    workspaceName: workspaceId.toUpperCase(),
    workspaceColor: "blue",
    workspacePosition,
    tabTitle: `tab ${tabIndex}`,
    tabIndex,
  };
}

describe("groupAgentsByWorkspace", () => {
  it("groups by workspace in panel order and sorts each group by tab order", () => {
    const groups = groupAgentsByWorkspace([
      agent("b2", placed("b", 1, 2)),
      agent("a1", placed("a", 0, 1)),
      agent("b0", placed("b", 1, 0)),
      agent("a0", placed("a", 0, 0)),
    ]);

    expect(groups.map((g) => g.workspaceName)).toEqual(["A", "B"]);
    expect(groups[0]?.agents.map((a) => a.terminalId)).toEqual(["a0", "a1"]);
    expect(groups[1]?.agents.map((a) => a.terminalId)).toEqual(["b0", "b2"]);
  });

  it("puts agents without a placement in a nameless group at the end", () => {
    const groups = groupAgentsByWorkspace([agent("x"), agent("a0", placed("a", 0, 0))]);

    expect(groups.map((g) => g.workspaceName)).toEqual(["A", undefined]);
    expect(groups[1]?.agents.map((a) => a.terminalId)).toEqual(["x"]);
  });
});
