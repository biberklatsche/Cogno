import { describe, expect, it } from "vitest";
import { countChanges } from "./git-change-counts";
import type { GitFile, GitFileStatus } from "./git-model";

function file(path: string, status: GitFileStatus): GitFile {
  return { path, status, isDirectory: false };
}

describe("countChanges", () => {
  it("sorts files into added, modified and deleted", () => {
    expect(
      countChanges({
        staged: [file("a.ts", "A"), file("b.ts", "M"), file("c.ts", "R")],
        unstaged: [file("d.ts", "D")],
        untracked: [file("e.ts", "?"), { path: "build/", status: "?", isDirectory: true }],
        conflicted: [file("f.ts", "U")],
      }),
    ).toEqual({ added: 3, modified: 3, deleted: 1 });
  });

  it("counts a path once, as the working tree has it", () => {
    expect(
      countChanges({
        // Staged and changed again: one change. New and changed again: still new.
        // Changed, then deleted in the working tree: gone.
        staged: [file("a.ts", "M"), file("b.ts", "A"), file("c.ts", "M")],
        unstaged: [file("a.ts", "M"), file("b.ts", "M"), file("c.ts", "D")],
        untracked: [],
        conflicted: [],
      }),
    ).toEqual({ added: 1, modified: 1, deleted: 1 });
  });

  it("is all zero for a clean tree", () => {
    expect(countChanges({ staged: [], unstaged: [], untracked: [], conflicted: [] })).toEqual({
      added: 0,
      modified: 0,
      deleted: 0,
    });
  });
});
