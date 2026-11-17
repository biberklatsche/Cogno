import { describe, expect, it } from "vitest";
import { conflictRows, conflictsOf, parseConflicts, resolveConflicts } from "./git-conflict";

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

  it("writes the taken side in place of the markers", () => {
    expect(resolveConflicts(segments, [["ours"]])).toEqual({
      text: "line1\nline2-main\nline3\n",
      starts: [6],
    });
    expect(resolveConflicts(segments, [["theirs"]]).text).toBe("line1\nline2-feature\nline3\n");
  });

  it("writes both sides in the order they were taken", () => {
    expect(resolveConflicts(segments, [["theirs", "ours"]]).text).toBe(
      "line1\nline2-feature\nline2-main\nline3\n",
    );
  });

  it("leaves nothing for a conflict nothing was taken for", () => {
    expect(resolveConflicts(segments, []).text).toBe("line1\nline3\n");
  });
});

describe("conflictRows", () => {
  const segments = parseConflicts(
    "a\n<<<<<<< HEAD\nb\n=======\nc\nd\n>>>>>>> feature\ne\n<<<<<<< HEAD\n=======\n>>>>>>> feature\n",
  );

  it("pads the shorter side so both stay level, numbering only real lines", () => {
    expect(conflictRows(segments, "ours")).toEqual([
      { text: "a", number: 1, conflict: null, first: false },
      { text: "b", number: 2, conflict: 0, first: true },
      { text: "", number: null, conflict: 0, first: false },
      { text: "e", number: 3, conflict: null, first: false },
      { text: "", number: null, conflict: 1, first: true },
    ]);
    expect(conflictRows(segments, "theirs").map((row) => row.number)).toEqual([1, 2, 3, 4, null]);
  });
});
