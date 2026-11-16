import { describe, expect, it } from "vitest";
import { conflictsOf, parseConflicts, resolveConflicts } from "./git-conflict";

const FILE = [
  "line1\n",
  "<<<<<<< HEAD\n",
  "line2-main\n",
  "=======\n",
  "line2-feature\n",
  ">>>>>>> feature\n",
  "line3\n",
].join("");

describe("parseConflicts", () => {
  it("splits agreed text and a conflict with its labels", () => {
    expect(parseConflicts(FILE)).toEqual([
      { kind: "text", text: "line1\n" },
      {
        kind: "conflict",
        ours: "line2-main\n",
        theirs: "line2-feature\n",
        oursLabel: "HEAD",
        theirsLabel: "feature",
      },
      { kind: "text", text: "line3\n" },
    ]);
  });

  it("leaves out the base of a diff3 conflict and keeps CRLF", () => {
    const crlf = "<<<<<<< HEAD\r\na\r\n||||||| base\r\nb\r\n=======\r\nc\r\n>>>>>>> x\r\n";
    expect(conflictsOf(parseConflicts(crlf))).toEqual([
      { kind: "conflict", ours: "a\r\n", theirs: "c\r\n", oursLabel: "HEAD", theirsLabel: "x" },
    ]);
  });

  it("reads an empty side and an end marker without a newline", () => {
    const text = "<<<<<<< HEAD\n=======\nonly theirs\n>>>>>>> feature";
    expect(conflictsOf(parseConflicts(text))).toEqual([
      {
        kind: "conflict",
        ours: "",
        theirs: "only theirs\n",
        oursLabel: "HEAD",
        theirsLabel: "feature",
      },
    ]);
  });

  it("keeps markers that do not close as text", () => {
    const text = "a\n<<<<<<< HEAD\nb\n=======\nc\n";
    expect(parseConflicts(text)).toEqual([{ kind: "text", text }]);
  });

  it("finds no conflict in a file without markers", () => {
    expect(conflictsOf(parseConflicts("a\n======= not a marker\nb\n"))).toEqual([]);
  });
});

describe("resolveConflicts", () => {
  const segments = parseConflicts(FILE);

  it("writes the chosen side in place of the markers", () => {
    expect(resolveConflicts(segments, ["ours"])).toBe("line1\nline2-main\nline3\n");
    expect(resolveConflicts(segments, ["theirs"])).toBe("line1\nline2-feature\nline3\n");
  });

  it("writes both sides, the current one first", () => {
    expect(resolveConflicts(segments, ["both"])).toBe("line1\nline2-main\nline2-feature\nline3\n");
  });

  it("has no result while a conflict is open", () => {
    expect(resolveConflicts(segments, [null])).toBeNull();
    expect(resolveConflicts(segments, [])).toBeNull();
  });
});
