import { describe, expect, it } from "vitest";
import { GitFile, GitFileStatus, parseGitStatus } from "./git-status.service";

function expectedGitFile(path: string, status: GitFileStatus, isDirectory = false): GitFile {
  return { path, status, isDirectory };
}

describe("parseGitStatus", () => {
  it("returns empty lists for empty input", () => {
    expect(parseGitStatus("")).toEqual({ staged: [], unstaged: [], untracked: [] });
  });

  it("classifies a modified staged file", () => {
    const result = parseGitStatus("M  src/foo.ts");
    expect(result.staged).toEqual([expectedGitFile("src/foo.ts", "M")]);
    expect(result.unstaged).toEqual([]);
  });

  it("classifies a modified unstaged file", () => {
    const result = parseGitStatus(" M src/foo.ts");
    expect(result.unstaged).toEqual([expectedGitFile("src/foo.ts", "M")]);
    expect(result.staged).toEqual([]);
  });

  it("classifies an untracked file", () => {
    const result = parseGitStatus("?? new-file.ts");
    expect(result.untracked).toEqual([expectedGitFile("new-file.ts", "?")]);
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
  });

  it("classifies an added staged file", () => {
    const result = parseGitStatus("A  src/new.ts");
    expect(result.staged).toEqual([expectedGitFile("src/new.ts", "A")]);
  });

  it("classifies a deleted staged file", () => {
    const result = parseGitStatus("D  src/old.ts");
    expect(result.staged).toEqual([expectedGitFile("src/old.ts", "D")]);
  });

  it("classifies a file that is both staged and has unstaged changes (AM)", () => {
    const result = parseGitStatus("AM src/foo.ts");
    expect(result.staged).toEqual([expectedGitFile("src/foo.ts", "A")]);
    expect(result.unstaged).toEqual([expectedGitFile("src/foo.ts", "M")]);
  });

  it("handles a renamed file — takes only the new path from porcelain v1 tab format", () => {
    const result = parseGitStatus("R  new-name.ts\told-name.ts");
    expect(result.staged).toEqual([expectedGitFile("new-name.ts", "R")]);
  });

  it("falls back to M for unknown status characters", () => {
    const result = parseGitStatus("U  src/conflict.ts");
    expect(result.staged).toEqual([expectedGitFile("src/conflict.ts", "M")]);
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
      expectedGitFile("staged-modified.ts", "M"),
      expectedGitFile("staged-added.ts", "A"),
    ]);
    expect(result.unstaged).toEqual([expectedGitFile("unstaged-modified.ts", "M")]);
    expect(result.untracked).toEqual([expectedGitFile("untracked.ts", "?")]);
  });

  it("ignores lines shorter than 3 characters", () => {
    const result = parseGitStatus("M \n\n  \nM  src/foo.ts");
    expect(result.staged).toEqual([expectedGitFile("src/foo.ts", "M")]);
  });
});
