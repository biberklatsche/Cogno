import { describe, expect, it } from "vitest";
import { GitFile, GitFileStatus } from "./git-model";
import {
  buildRefLabels,
  cloneDirectoryName,
  parseCommitDetail,
  parseGitStatus,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseRemotes,
  parseStashes,
  parseTrack,
} from "./git-parsers";

function file(path: string, status: GitFileStatus, isDirectory = false): GitFile {
  return { path, status, isDirectory };
}

/** NUL-terminated entries, as git prints them with `-z`. */
const z = (...entries: string[]) => entries.map((entry) => `${entry}\0`).join("");
const f = (...fields: string[]) => fields.join("\x1f");

describe("parseGitStatus", () => {
  it("returns empty lists for empty input", () => {
    expect(parseGitStatus("")).toEqual({ staged: [], unstaged: [], untracked: [], conflicted: [] });
  });

  it("classifies staged, unstaged and untracked files", () => {
    const result = parseGitStatus(
      z("M  staged-modified.ts", " M unstaged-modified.ts", "A  staged-added.ts", "?? new.ts"),
    );
    expect(result.staged).toEqual([file("staged-modified.ts", "M"), file("staged-added.ts", "A")]);
    expect(result.unstaged).toEqual([file("unstaged-modified.ts", "M")]);
    expect(result.untracked).toEqual([file("new.ts", "?")]);
  });

  it("lists a file that is staged and changed again in both lists (AM)", () => {
    const result = parseGitStatus(z("AM src/foo.ts"));
    expect(result.staged).toEqual([file("src/foo.ts", "A")]);
    expect(result.unstaged).toEqual([file("src/foo.ts", "M")]);
  });

  it("keeps the source of a rename and skips its entry", () => {
    // Real output of `git mv "old name.txt" "new name.txt"` next to a modified file.
    const result = parseGitStatus(z("R  new name.txt", "old name.txt", " M plain.txt"));
    expect(result.staged).toEqual([{ ...file("new name.txt", "R"), oldPath: "old name.txt" }]);
    expect(result.unstaged).toEqual([file("plain.txt", "M")]);
  });

  it("keeps spaces and non-ASCII characters in paths as they are", () => {
    const result = parseGitStatus(z("?? neu ä.txt", " M my file.txt"));
    expect(result.untracked).toEqual([file("neu ä.txt", "?")]);
    expect(result.unstaged).toEqual([file("my file.txt", "M")]);
  });

  it("puts unmerged paths only into the conflict list", () => {
    const result = parseGitStatus(z("UU both.ts", "AA added.ts", "DU deleted.ts"));
    expect(result.conflicted).toEqual([
      file("both.ts", "U"),
      file("added.ts", "U"),
      file("deleted.ts", "U"),
    ]);
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
  });

  it("marks an untracked directory", () => {
    expect(parseGitStatus(z("?? build/")).untracked).toEqual([file("build", "?", true)]);
  });
});

describe("parseRefs", () => {
  it("splits heads, remote branches and tags and skips the remote HEAD pointer", () => {
    const raw = [
      f("refs/heads/main", "c1", "", "origin/main", "ahead 2, behind 1"),
      f("refs/heads/feature/x", "c2", "", "", ""),
      f("refs/remotes/origin/HEAD", "c1", "", "", ""),
      f("refs/remotes/origin/feature/x", "c3", "", "", ""),
      f("refs/tags/v1", "tagobj", "c4", "", ""),
      f("refs/tags/light", "c5", "", "", ""),
    ].join("\n");

    expect(parseRefs(raw)).toEqual({
      branches: [
        {
          name: "main",
          sha: "c1",
          upstream: "origin/main",
          ahead: 2,
          behind: 1,
          upstreamGone: false,
        },
        { name: "feature/x", sha: "c2", upstream: null, ahead: 0, behind: 0, upstreamGone: false },
      ],
      remoteBranches: [
        { name: "origin/feature/x", remote: "origin", shortName: "feature/x", sha: "c3" },
      ],
      tags: [
        { name: "v1", sha: "c4" },
        { name: "light", sha: "c5" },
      ],
    });
  });

  it("reads a gone upstream", () => {
    expect(parseTrack("gone")).toEqual({ ahead: 0, behind: 0, upstreamGone: true });
  });
});

describe("parseRemotes", () => {
  it("lists each remote once with its fetch url", () => {
    const raw = [
      "origin\tgit@github.com:a/b.git (fetch)",
      "origin\tgit@github.com:a/b-push.git (push)",
      "upstream\thttps://x/y.git (fetch)",
      "upstream\thttps://x/y.git (push)",
    ].join("\n");

    expect(parseRemotes(raw)).toEqual([
      { name: "origin", url: "git@github.com:a/b.git" },
      { name: "upstream", url: "https://x/y.git" },
    ]);
  });
});

describe("parseStashes", () => {
  it("reads index, ref and message", () => {
    const raw = [
      f("s0", "stash@{0}", "100", "WIP on main: abc msg"),
      f("s1", "stash@{1}", "50", "On dev: x"),
    ].join("\n");

    expect(parseStashes(raw)).toEqual([
      { index: 0, ref: "stash@{0}", sha: "s0", message: "WIP on main: abc msg", timestamp: 100 },
      { index: 1, ref: "stash@{1}", sha: "s1", message: "On dev: x", timestamp: 50 },
    ]);
  });
});

describe("parseLog", () => {
  it("reads records with parents and keeps separators inside fields apart", () => {
    const raw = `${f("c2", "c1 m1", "Ana", "ana@x", "200", "Merge: a | b")}\x1e\n${f("c1", "", "Bo", "bo@x", "100", "init")}\x1e\n`;

    expect(parseLog(raw)).toEqual([
      {
        sha: "c2",
        parents: ["c1", "m1"],
        author: "Ana",
        email: "ana@x",
        timestamp: 200,
        subject: "Merge: a | b",
      },
      { sha: "c1", parents: [], author: "Bo", email: "bo@x", timestamp: 100, subject: "init" },
    ]);
  });
});

describe("parseNameStatus", () => {
  it("reads plain entries and renames with their source", () => {
    const raw = z("M", "a.ts", "R087", "old.ts", "new.ts", "D", "gone.ts", "A", "neu ä.ts");

    expect(parseNameStatus(raw)).toEqual([
      file("a.ts", "M"),
      { ...file("new.ts", "R"), oldPath: "old.ts" },
      file("gone.ts", "D"),
      file("neu ä.ts", "A"),
    ]);
  });
});

describe("parseCommitDetail", () => {
  it("keeps the full multi-line message", () => {
    const raw = f("c1", "p1", "Ana", "ana@x", "10", "Bo", "20", "Subject\n\nBody line\n");

    expect(parseCommitDetail(raw, [])).toEqual({
      sha: "c1",
      parents: ["p1"],
      author: "Ana",
      email: "ana@x",
      authorTime: 10,
      committer: "Bo",
      commitTime: 20,
      message: "Subject\n\nBody line",
      files: [],
    });
  });

  it("returns null for unexpected output", () => {
    expect(parseCommitDetail("garbage", [])).toBeNull();
  });
});

describe("buildRefLabels", () => {
  it("groups labels by commit and marks the checked-out branch", () => {
    const labels = buildRefLabels(
      {
        branches: [
          { name: "main", sha: "c1", upstream: null, ahead: 0, behind: 0, upstreamGone: false },
        ],
        remoteBranches: [{ name: "origin/main", remote: "origin", shortName: "main", sha: "c1" }],
        tags: [{ name: "v1", sha: "c2" }],
      },
      { sha: "c1", branch: "main" },
    );

    expect(labels.get("c1")).toEqual([
      { kind: "branch", name: "main", isHead: true },
      { kind: "remote", name: "origin/main", isHead: false },
    ]);
    expect(labels.get("c2")).toEqual([{ kind: "tag", name: "v1", isHead: false }]);
  });
});

describe("cloneDirectoryName", () => {
  it.each([
    ["https://github.com/morluto/rea.git", "rea"],
    ["git@github.com:a/b.git", "b"],
    ["https://host/x/y/", "y"],
    ["git@host:repo", "repo"],
  ])("derives the folder of %s", (url, expected) => {
    expect(cloneDirectoryName(url)).toBe(expected);
  });
});
