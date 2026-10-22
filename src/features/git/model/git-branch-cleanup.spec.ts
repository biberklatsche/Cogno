import { describe, expect, it } from "vitest";
import { ageReference, byRemote, keptReason, remoteBranchesToDelete } from "./git-branch-cleanup";
import { GitBranch, GitRefs, GitRemoteBranch } from "./git-model";

function branch(name: string, extra: Partial<GitBranch> = {}): GitBranch {
  return {
    name,
    sha: "c1",
    upstream: null,
    ahead: 0,
    behind: 0,
    upstreamGone: false,
    lastCommitAt: 0,
    tipIsMerge: false,
    ...extra,
  };
}

function remoteBranch(name: string, lastCommitAt = 0): GitRemoteBranch {
  const slash = name.indexOf("/");
  return {
    name,
    remote: name.slice(0, slash),
    shortName: name.slice(slash + 1),
    sha: "c1",
    lastCommitAt,
  };
}

function refs(extra: Partial<GitRefs> = {}): GitRefs {
  return { branches: [], remoteBranches: [], tags: [], defaultBranches: [], ...extra };
}

describe("ageReference", () => {
  it("is the newest commit on any local or remote branch", () => {
    const reference = ageReference(
      refs({
        branches: [branch("main", { lastCommitAt: 100 })],
        remoteBranches: [remoteBranch("origin/x", 300), remoteBranch("origin/y", 200)],
      }),
    );

    expect(reference).toBe(300);
  });

  it("is 0 without branches", () => {
    expect(ageReference(refs())).toBe(0);
  });
});

describe("keptReason", () => {
  const head = { sha: "c1", branch: "feature/x" };

  it("keeps the checked-out branch and the default branches", () => {
    const repoRefs = refs({ defaultBranches: ["develop"] });

    expect(keptReason(branch("feature/x"), repoRefs, head)).toBe("checked out");
    expect(keptReason(branch("develop"), repoRefs, head)).toBe("default branch");
    expect(keptReason(branch("main"), repoRefs, head)).toBe("default branch");
    expect(keptReason(remoteBranch("origin/master"), repoRefs, head)).toBe("default branch");
    expect(keptReason(branch("feature/y"), repoRefs, head)).toBeNull();
  });

  it("does not keep a remote branch for having the name of the checked-out one", () => {
    expect(keptReason(remoteBranch("origin/feature/x"), refs(), head)).toBeNull();
  });
});

describe("remoteBranchesToDelete", () => {
  const head = { sha: null, branch: null };
  const repoRefs = refs({
    branches: [
      branch("a", { upstream: "origin/a" }),
      branch("a-wip", { upstream: "origin/a" }),
      branch("b", { upstream: "origin/b" }),
      branch("keeper", { upstream: "origin/b" }),
      branch("gone", { upstream: "origin/gone", upstreamGone: true }),
      branch("tracks-main", { upstream: "origin/main" }),
      branch("local"),
    ],
    remoteBranches: [
      remoteBranch("origin/a"),
      remoteBranch("origin/b"),
      remoteBranch("origin/main"),
    ],
  });

  it("returns each existing upstream once, when all branches tracking it go", () => {
    expect(remoteBranchesToDelete(["a", "a-wip", "gone", "local"], repoRefs, head)).toEqual([
      remoteBranch("origin/a"),
    ]);
  });

  it("keeps an upstream another local branch still tracks, and the default branches", () => {
    expect(remoteBranchesToDelete(["a", "b", "tracks-main"], repoRefs, head)).toEqual([]);
  });
});

describe("byRemote", () => {
  it("groups short names by remote", () => {
    expect(
      byRemote([remoteBranch("origin/a"), remoteBranch("fork/b"), remoteBranch("origin/c")]),
    ).toEqual(
      new Map([
        ["origin", ["a", "c"]],
        ["fork", ["b"]],
      ]),
    );
  });
});
