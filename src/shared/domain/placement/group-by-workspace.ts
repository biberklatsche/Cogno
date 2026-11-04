import { TerminalPlacement } from "./terminal-placement";

/**
 * The items of one workspace, in tab order. Items without a placement share a
 * nameless group at the end.
 */
export type WorkspaceGroup<T> = {
  readonly workspaceId: string;
  readonly workspaceName?: string;
  readonly workspaceColor?: string;
  readonly items: ReadonlyArray<T>;
};

const UNPLACED = "";
const LAST = Number.MAX_SAFE_INTEGER;

/** Groups `items` by the workspace of their placement, workspaces in panel order, items in tab order. */
export function groupByWorkspace<T>(
  items: ReadonlyArray<T>,
  placementOf: (item: T) => TerminalPlacement | undefined,
): WorkspaceGroup<T>[] {
  const byWorkspace = new Map<string, T[]>();
  for (const item of items) {
    const key = placementOf(item)?.workspaceId ?? UNPLACED;
    byWorkspace.set(key, [...(byWorkspace.get(key) ?? []), item]);
  }

  return [...byWorkspace.entries()]
    .map(([workspaceId, members]) => {
      const placement = members[0] === undefined ? undefined : placementOf(members[0]);
      return {
        workspaceId,
        workspaceName: placement?.workspaceName,
        workspaceColor: placement?.workspaceColor,
        position: placement?.workspacePosition ?? LAST,
        items: [...members].sort(
          (a, b) => (placementOf(a)?.tabIndex ?? LAST) - (placementOf(b)?.tabIndex ?? LAST),
        ),
      };
    })
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...group }) => group);
}
