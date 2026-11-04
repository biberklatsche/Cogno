import { describe, expect, it } from "vitest";
import { groupByWorkspace } from "./group-by-workspace";
import type { TerminalPlacement } from "./terminal-placement";

type Item = { readonly id: string; readonly placement?: TerminalPlacement };

function item(id: string, placement?: TerminalPlacement): Item {
  return { id, placement };
}

function placed(
  workspaceId: string,
  workspacePosition: number,
  tabIndex: number,
): TerminalPlacement {
  return {
    workspaceId,
    workspaceName: workspaceId.toUpperCase(),
    workspaceColor: "blue",
    workspacePosition,
    tabTitle: `tab ${tabIndex}`,
    tabIndex,
  };
}

const placementOf = (entry: Item) => entry.placement;

describe("groupByWorkspace", () => {
  it("groups by workspace in panel order and sorts each group by tab order", () => {
    const groups = groupByWorkspace(
      [
        item("b2", placed("b", 1, 2)),
        item("a1", placed("a", 0, 1)),
        item("b0", placed("b", 1, 0)),
        item("a0", placed("a", 0, 0)),
      ],
      placementOf,
    );

    expect(groups.map((g) => g.workspaceName)).toEqual(["A", "B"]);
    expect(groups[0]?.workspaceColor).toBe("blue");
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["a0", "a1"]);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(["b0", "b2"]);
  });

  it("puts items without a placement in a nameless group at the end", () => {
    const groups = groupByWorkspace([item("x"), item("a0", placed("a", 0, 0))], placementOf);

    expect(groups.map((g) => g.workspaceName)).toEqual(["A", undefined]);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(["x"]);
  });
});
