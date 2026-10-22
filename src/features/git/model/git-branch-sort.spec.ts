import { describe, expect, it } from "vitest";
import { nextSort, sortBranches } from "./git-branch-sort";
import { GitBranch, GitRefs, GitRemoteBranch } from "./git-model";

function branch(name: string, lastCommitAt: number): GitBranch {
  return {
    name,
    sha: "c1",
    upstream: null,
    ahead: 0,
    behind: 0,
    upstreamGone: false,
    lastCommitAt,
  };
}

function remoteBranch(name: string, lastCommitAt: number): GitRemoteBranch {
  const slash = name.indexOf("/");
  return {
    name,
    remote: name.slice(0, slash),
    shortName: name.slice(slash + 1),
    sha: "c1",
    lastCommitAt,
  };
}

function refs(defaultBranches: string[] = []): GitRefs {
  return { branches: [], remoteBranches: [], tags: [], defaultBranches };
}

const names = (branches: ReadonlyArray<GitBranch | GitRemoteBranch>) => branches.map((b) => b.name);

describe("nextSort", () => {
  it("steps from newest first through oldest first and A to Z to Z to A and back", () => {
    expect(nextSort("date-desc")).toBe("date-asc");
    expect(nextSort("date-asc")).toBe("name-asc");
    expect(nextSort("name-asc")).toBe("name-desc");
    expect(nextSort("name-desc")).toBe("date-desc");
  });
});

describe("sortBranches", () => {
  const branches = [branch("b", 100), branch("main", 50), branch("a", 300), branch("c", 100)];

  it("orders by date or name and keeps main on top in every order", () => {
    expect(names(sortBranches(branches, "date-desc", refs()))).toEqual(["main", "a", "b", "c"]);
    expect(names(sortBranches(branches, "date-asc", refs()))).toEqual(["main", "b", "c", "a"]);
    expect(names(sortBranches(branches, "name-asc", refs()))).toEqual(["main", "a", "b", "c"]);
    expect(names(sortBranches(branches, "name-desc", refs()))).toEqual(["main", "c", "b", "a"]);
  });

  it("keeps the branch the remote HEAD points at on top, and remote default branches too", () => {
    const remote = [remoteBranch("origin/x", 300), remoteBranch("origin/develop", 10)];

    expect(names(sortBranches(remote, "date-desc", refs(["develop"])))).toEqual([
      "origin/develop",
      "origin/x",
    ]);
  });

  it("compares numbers in names by value", () => {
    const numbered = [branch("issue-10", 0), branch("issue-9", 0)];

    expect(names(sortBranches(numbered, "name-asc", refs()))).toEqual(["issue-9", "issue-10"]);
  });
});
