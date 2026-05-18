import { describe, expect, it } from "vitest";
import { parseGitStatus } from "./git-status.service";

describe("parseGitStatus", () => {
  it("returns empty lists for empty input", () => {
    expect(parseGitStatus("")).toEqual({ staged: [], unstaged: [], untracked: [] });
  });

  it("classifies a modified staged file", () => {
    const result = parseGitStatus("M  src/foo.ts");
    expect(result.staged).toEqual([{ path: "src/foo.ts", status: "M" }]);
    expect(result.unstaged).toEqual([]);
  });

  it("classifies a modified unstaged file", () => {
    const result = parseGitStatus(" M src/foo.ts");
    expect(result.unstaged).toEqual([{ path: "src/foo.ts", status: "M" }]);
    expect(result.staged).toEqual([]);
  });

  it("classifies an untracked file", () => {
    const result = parseGitStatus("?? new-file.ts");
    expect(result.untracked).toEqual([{ path: "new-file.ts", status: "?" }]);
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
  });

  it("classifies an added staged file", () => {
    const result = parseGitStatus("A  src/new.ts");
    expect(result.staged).toEqual([{ path: "src/new.ts", status: "A" }]);
  });

  it("classifies a deleted staged file", () => {
    const result = parseGitStatus("D  src/old.ts");
    expect(result.staged).toEqual([{ path: "src/old.ts", status: "D" }]);
  });

  it("classifies a file that is both staged and has unstaged changes (AM)", () => {
    const result = parseGitStatus("AM src/foo.ts");
    expect(result.staged).toEqual([{ path: "src/foo.ts", status: "A" }]);
    expect(result.unstaged).toEqual([{ path: "src/foo.ts", status: "M" }]);
  });

  it("handles a renamed file — takes only the new path from porcelain v1 tab format", () => {
    const result = parseGitStatus("R  new-name.ts\told-name.ts");
    expect(result.staged).toEqual([{ path: "new-name.ts", status: "R" }]);
  });

  it("falls back to M for unknown status characters", () => {
    const result = parseGitStatus("U  src/conflict.ts");
    expect(result.staged).toEqual([{ path: "src/conflict.ts", status: "M" }]);
  });

  it("handles multiple files with mixed states", () => {
    const raw = [
      "M  staged-modified.ts",
      " M unstaged-modified.ts",
      "A  staged-added.ts",
      "?? untracked.ts",
    ].join("\n");

    const result = parseGitStatus(raw);
    expect(result.staged).toEqual([
      { path: "staged-modified.ts", status: "M" },
      { path: "staged-added.ts", status: "A" },
    ]);
    expect(result.unstaged).toEqual([{ path: "unstaged-modified.ts", status: "M" }]);
    expect(result.untracked).toEqual([{ path: "untracked.ts", status: "?" }]);
  });

  it("ignores lines shorter than 3 characters", () => {
    const result = parseGitStatus("M \n\n  \nM  src/foo.ts");
    expect(result.staged).toEqual([{ path: "src/foo.ts", status: "M" }]);
  });
});
