import { describe, expect, it } from "vitest";
import { GraphRow, layoutGraph, layoutWips } from "./git-graph";

const commit = (sha: string, ...parents: string[]) => ({ sha, parents });

/** Segments of a row as compact strings: `top 0>1`, `bottom 1>1`. */
function segmentsOf(row: GraphRow | undefined): string[] {
  return (row?.segments ?? []).map((s) => `${s.half} ${s.from}>${s.to}`).sort();
}

describe("layoutGraph", () => {
  it("draws a linear history in one lane", () => {
    const rows = layoutGraph([commit("c", "b"), commit("b", "a"), commit("a")]);

    expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(segmentsOf(rows[0])).toEqual(["bottom 0>0"]);
    expect(segmentsOf(rows[1])).toEqual(["bottom 0>0", "top 0>0"]);
    expect(segmentsOf(rows[2])).toEqual(["top 0>0"]);
  });

  it("opens a lane for the second parent of a merge and joins it at the fork point", () => {
    // m merges feature f into main b; both come from a.
    const rows = layoutGraph([
      commit("m", "b", "f"),
      commit("f", "a"),
      commit("b", "a"),
      commit("a"),
    ]);

    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0, 0]);
    expect(segmentsOf(rows[0])).toEqual(["bottom 0>0", "bottom 0>1"]);
    expect(segmentsOf(rows[1])).toEqual(["bottom 0>0", "bottom 1>1", "top 0>0", "top 1>1"]);
    // b hands its lane to a, which lane 1 also waits for.
    expect(segmentsOf(rows[2])).toEqual(["bottom 0>0", "bottom 1>1", "top 0>0", "top 1>1"]);
    expect(segmentsOf(rows[3])).toEqual(["top 0>0", "top 1>0"]);
    expect(rows[3]?.width).toBe(2);
  });

  it("keeps a waiting lane running past a merge whose second parent it waits for", () => {
    // Lane 1 (f) waits for a; m, further down lane 0, merges a in as well.
    const rows = layoutGraph([
      commit("f", "a"),
      commit("m", "b", "a"),
      commit("b", "a"),
      commit("a"),
    ]);

    expect(rows.map((row) => row.lane)).toEqual([0, 1, 1, 0]);
    expect(segmentsOf(rows[1])).toEqual(["bottom 0>0", "bottom 1>0", "bottom 1>1", "top 0>0"]);
  });

  it("starts a new lane for a second branch tip and reuses it after it ends", () => {
    const rows = layoutGraph([commit("x", "a"), commit("y", "a"), commit("a"), commit("z")]);

    expect(rows.map((row) => row.lane)).toEqual([0, 1, 0, 0]);
    expect(segmentsOf(rows[1])).toEqual(["bottom 0>0", "bottom 1>1", "top 0>0"]);
    // The unrelated root z gets the freed lane 0 without a line from above.
    expect(segmentsOf(rows[3])).toEqual([]);
  });

  it("gives every new lane its own color and keeps it along the lane", () => {
    const rows = layoutGraph([commit("m", "b", "f"), commit("f", "b"), commit("b")]);

    const mainColor = rows[0]?.color;
    const featureColor = rows[1]?.color;
    expect(featureColor).not.toBe(mainColor);
    expect(rows[2]?.color).toBe(mainColor);
  });

  it("keeps the first lane for the checked-out commit, as GitKraken does", () => {
    // Branch x is newer than HEAD h; both come from a.
    const rows = layoutGraph([commit("x", "a"), commit("h", "a"), commit("a")], "h");

    expect(rows.map((row) => row.lane)).toEqual([1, 0, 0]);
    expect(segmentsOf(rows[0])).toEqual(["bottom 1>1"]);
    // No line above HEAD's node: the first lane starts there.
    expect(segmentsOf(rows[1])).toEqual(["bottom 0>0", "bottom 1>1", "top 1>1"]);
    expect(segmentsOf(rows[2])).toEqual(["top 0>0", "top 1>0"]);
    expect(rows[1]?.color).toBe(0);
    expect(rows[0]?.width).toBe(2);
  });

  it("joins a tip that sits on HEAD into HEAD's first lane", () => {
    const rows = layoutGraph([commit("x", "h"), commit("h", "a"), commit("a")], "h");

    expect(rows.map((row) => row.lane)).toEqual([1, 0, 0]);
    expect(segmentsOf(rows[1])).toEqual(["bottom 0>0", "top 1>0"]);
  });

  it("draws a merge of HEAD straight into HEAD's first lane", () => {
    // Above HEAD h: n, then m, which merges h; another branch b holds lane 2 meanwhile.
    const rows = layoutGraph(
      [
        commit("n", "m", "b"),
        commit("m", "p", "h"),
        commit("h", "p"),
        commit("b", "p"),
        commit("p"),
      ],
      "h",
    );

    expect(rows.map((row) => row.lane)).toEqual([1, 1, 0, 2, 0]);
    // The merge line goes left into lane 0, not out to a free lane on the right.
    expect(segmentsOf(rows[1])).toEqual([
      "bottom 1>0",
      "bottom 1>1",
      "bottom 2>2",
      "top 1>1",
      "top 2>2",
    ]);
    expect(segmentsOf(rows[2])).toEqual([
      "bottom 0>0",
      "bottom 1>1",
      "bottom 2>2",
      "top 0>0",
      "top 1>1",
      "top 2>2",
    ]);
    expect(rows[1]?.segments.find((s) => s.to === 0)?.color).toBe(rows[2]?.color);
    expect(Math.max(...rows.map((row) => row.width))).toBe(3);
  });

  it("joins a merge of HEAD into the lane already drawn towards it", () => {
    // Tip x sits on HEAD h, so lane 1 runs down to h; m, further down, merges h as well.
    const rows = layoutGraph(
      [commit("x", "h"), commit("m", "p", "h"), commit("h", "p"), commit("p")],
      "h",
    );

    expect(rows.map((row) => row.lane)).toEqual([1, 2, 0, 0]);
    expect(segmentsOf(rows[1])).toEqual(["bottom 1>1", "bottom 2>1", "bottom 2>2", "top 1>1"]);
    // One line into HEAD, the one lane 1 brings; lane 0 starts at HEAD's node.
    expect(segmentsOf(rows[2])).toEqual(["bottom 0>0", "bottom 2>2", "top 1>0", "top 2>2"]);
  });

  it("does not start HEAD's lane for a commit whose parents are both HEAD", () => {
    const rows = layoutGraph([commit("m", "h", "h"), commit("h")], "h");

    // Both parents go down m's own lane, which already waits for h.
    expect(segmentsOf(rows[0])).toEqual(["bottom 1>1", "bottom 1>1"]);
    expect(segmentsOf(rows[1])).toEqual(["top 1>0"]);
  });

  it("reserves nothing when HEAD is not among the loaded commits", () => {
    const rows = layoutGraph([commit("b", "a"), commit("a")], "elsewhere");

    expect(rows.map((row) => row.lane)).toEqual([0, 0]);
  });

  it("keeps a lane running when the parent is outside the loaded commits", () => {
    const rows = layoutGraph([commit("b", "a")]);

    expect(segmentsOf(rows[0])).toEqual(["bottom 0>0"]);
  });
});

describe("layoutWips", () => {
  // HEAD is b in lane 0; the branch tip c stands above it in lane 1, both on a.
  const rows = layoutGraph([commit("c", "a"), commit("b", "a"), commit("a")], "b");

  it("runs the own line from the top down the lane of HEAD", () => {
    const layout = layoutWips(rows, 1, []);

    expect(layout.slots).toEqual([]);
    expect(layout.inCommitRows).toEqual([
      [{ from: 0, to: 0, end: false }],
      [{ from: 0, to: 0, end: true }],
      [],
    ]);
  });

  it("puts a worktree's row above a branch tip in the tip's lane", () => {
    const layout = layoutWips(rows, null, [0]);

    expect(layout.slots).toEqual([{ lane: 1, through: [], passing: [] }]);
    expect(layout.inCommitRows).toEqual([[{ from: 1, to: 1, end: true }], [], []]);
  });

  it("puts a worktree's row beside the lines that run into its commit", () => {
    const layout = layoutWips(rows, null, [2]);

    expect(layout.slots).toEqual([
      {
        lane: 2,
        through: [
          { lane: 0, color: 0 },
          { lane: 1, color: 1 },
        ],
        passing: [],
      },
    ]);
    expect(layout.inCommitRows[2]).toEqual([{ from: 2, to: 0, end: true }]);
  });

  it("keeps a worktree's row out of the own line and of the rows of the same commit", () => {
    // Two worktrees stand on HEAD itself, which the own line runs down to.
    const layout = layoutWips(rows, 1, [1, 1]);

    expect(layout.slots).toEqual([
      { lane: 2, through: [{ lane: 1, color: 1 }], passing: [0] },
      { lane: 3, through: [{ lane: 1, color: 1 }], passing: [0, 2] },
    ]);
    expect(layout.inCommitRows[1]).toEqual([
      { from: 0, to: 0, end: true },
      { from: 2, to: 0, end: true },
      { from: 3, to: 0, end: true },
    ]);
  });
});
