import { ActiveAgent } from "./coding-agent-status.service";

/**
 * The agents of one workspace, in tab order. Agents without a placement share a
 * nameless group at the end.
 */
export type AgentGroup = {
  readonly workspaceId: string;
  readonly workspaceName?: string;
  readonly workspaceColor?: string;
  readonly agents: ReadonlyArray<ActiveAgent>;
};

const UNPLACED = "";
const LAST = Number.MAX_SAFE_INTEGER;

export function groupAgentsByWorkspace(agents: ReadonlyArray<ActiveAgent>): AgentGroup[] {
  const byWorkspace = new Map<string, ActiveAgent[]>();
  for (const agent of agents) {
    const key = agent.placement?.workspaceId ?? UNPLACED;
    byWorkspace.set(key, [...(byWorkspace.get(key) ?? []), agent]);
  }

  return [...byWorkspace.entries()]
    .map(([workspaceId, members]) => {
      const placement = members[0]?.placement;
      return {
        workspaceId,
        workspaceName: placement?.workspaceName,
        workspaceColor: placement?.workspaceColor,
        position: placement?.workspacePosition ?? LAST,
        agents: [...members].sort(
          (a, b) => (a.placement?.tabIndex ?? LAST) - (b.placement?.tabIndex ?? LAST),
        ),
      };
    })
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...group }) => group);
}
