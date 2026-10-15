import { describe, expect, it } from "vitest";
import { buildHunkPatch, parseGitPatch } from "./git-patch";

const DIFF = [
  "diff --git a/src/a.ts b/src/a.ts",
  "index 1111111..2222222 100644",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1,3 +1,4 @@ function a() {",
  " keep",
  "-old",
  "+new",
  "+added",
  " tail",
  "@@ -10,2 +11,2 @@",
  "-x",
  "+y",
  "\\ No newline at end of file",
  "",
].join("\n");

describe("parseGitPatch", () => {
  it("reads header, hunks and line numbers", () => {
    const patch = parseGitPatch(DIFF);

    expect(patch.binary).toBe(false);
    expect(patch.header).toEqual([
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
    ]);
    expect(patch.hunks).toHaveLength(2);
    const [first, second] = patch.hunks;
    expect(first).toMatchObject({
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 4,
      heading: "function a() {",
    });
    expect(first?.lines).toEqual([
      { kind: "context", text: "keep", oldNumber: 1, newNumber: 1 },
      { kind: "del", text: "old", oldNumber: 2 },
      { kind: "add", text: "new", newNumber: 2 },
      { kind: "add", text: "added", newNumber: 3 },
      { kind: "context", text: "tail", oldNumber: 3, newNumber: 4 },
    ]);
    expect(second?.lines[1]).toEqual({ kind: "add", text: "y", newNumber: 11, noNewline: true });
  });

  it("marks a binary diff and reads an empty diff as no hunks", () => {
    expect(parseGitPatch("diff --git a/x b/x\nBinary files a/x and b/x differ\n").binary).toBe(
      true,
    );
    expect(parseGitPatch("")).toEqual({ header: [], hunks: [], binary: false });
  });
});

describe("buildHunkPatch", () => {
  const patch = parseGitPatch(DIFF);

  it("rebuilds a whole hunk with the file header, without the index line", () => {
    const text = buildHunkPatch(patch, patch.hunks[0] as never);

    expect(text).toBe(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,3 +1,4 @@ function a() {",
        " keep",
        "-old",
        "+new",
        "+added",
        " tail",
        "",
      ].join("\n"),
    );
  });

  it("keeps only chosen lines: unchosen additions vanish, unchosen deletions become context", () => {
    // Only "+added" (index 3) is chosen: "-old" stays, "+new" is left out.
    const text = buildHunkPatch(patch, patch.hunks[0] as never, new Set([3]));

    // "-old" became context, "+new" is gone: 3 old lines, 4 new ones.
    expect(text).toContain("@@ -1,3 +1,4 @@ function a() {");
    expect(text?.split("\n").slice(4, 9)).toEqual([" keep", " old", "+added", " tail", ""]);
  });

  it("keeps the missing-newline marker behind its line", () => {
    const text = buildHunkPatch(patch, patch.hunks[1] as never);

    expect(text?.endsWith("+y\n\\ No newline at end of file\n")).toBe(true);
  });

  it("is null when no chosen line changes anything", () => {
    expect(buildHunkPatch(patch, patch.hunks[0] as never, new Set([0, 4]))).toBeNull();
  });
});
