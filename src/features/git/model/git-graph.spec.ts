import { describe, expect, it } from "vitest";
import { GraphRow, layoutGraph } from "./git-graph";

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

  it("keeps a lane running when the parent is outside the loaded commits", () => {
    const rows = layoutGraph([commit("b", "a")]);

    expect(segmentsOf(rows[0])).toEqual(["bottom 0>0"]);
  });
});
