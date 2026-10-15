import type { CommandRunnerResultContract } from "@cogno/core/api/command-runner-port";
import type { BoundSessionHandle } from "@cogno/core/api/session-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitDiffService } from "./git-diff.service";
import type { GitRepositoryService } from "./git-repository.service";
import { GitFile } from "./model/git-model";

const file = (path: string, status: GitFile["status"], oldPath?: string): GitFile => ({
  path,
  status,
  isDirectory: false,
  ...(oldPath ? { oldPath } : {}),
});

describe("GitDiffService", () => {
  let run: ReturnType<typeof vi.fn>;
  let readTextFile: ReturnType<typeof vi.fn>;
  let service: GitDiffService;

  beforeEach(() => {
    // Every blob read answers with its revision, so the test sees which one was read.
    run = vi.fn(
      (args: string[]): Promise<CommandRunnerResultContract> =>
        Promise.resolve({ stdout: `blob ${args.at(-1)}`, stderr: "", exitCode: 0 }),
    );
    readTextFile = vi.fn().mockResolvedValue("working tree");
    const session = {
      fs: { readTextFile, normalizePath: (path: string) => `/normalized${path}` },
    } as unknown as BoundSessionHandle;
    const repository = {
      run,
      root: () => "/c/repo",
      currentSession: () => session,
    } as unknown as GitRepositoryService;
    service = new GitDiffService(repository);
  });

  it("compares the index with the working tree for an unstaged file", async () => {
    const diff = await service.loadDiff({ kind: "unstaged", file: file("src/a.ts", "M") });

    expect(diff).toEqual({
      original: "blob :0:src/a.ts",
      modified: "working tree",
      language: "typescript",
    });
    expect(readTextFile).toHaveBeenCalledWith("/normalized/c/repo/src/a.ts");
  });

  it("compares HEAD with the index for a staged file and never reads the working tree", async () => {
    const diff = await service.loadDiff({ kind: "staged", file: file("src/a.ts", "M") });

    expect(diff.original).toBe("blob HEAD:src/a.ts");
    expect(diff.modified).toBe("blob :0:src/a.ts");
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("has an empty original for an untracked file", async () => {
    const diff = await service.loadDiff({ kind: "unstaged", file: file("new.ts", "?") });

    expect(diff.original).toBe("");
    expect(diff.modified).toBe("working tree");
  });

  it("compares a commit with its first parent and follows a rename", async () => {
    const diff = await service.loadDiff({
      kind: "commit",
      file: file("new.ts", "R", "old.ts"),
      sha: "c2",
      parent: "c1",
    });

    expect(diff.original).toBe("blob c1:old.ts");
    expect(diff.modified).toBe("blob c2:new.ts");
  });

  it("has an empty original for a file of the root commit and an empty side for a deletion", async () => {
    const root = await service.loadDiff({
      kind: "commit",
      file: file("a.ts", "M"),
      sha: "c1",
      parent: null,
    });
    const deleted = await service.loadDiff({
      kind: "commit",
      file: file("a.ts", "D"),
      sha: "c2",
      parent: "c1",
    });

    expect(root.original).toBe("");
    expect(deleted.modified).toBe("");
  });

  it("compares a conflicted file with HEAD, since the index holds several versions", async () => {
    const diff = await service.loadDiff({ kind: "unstaged", file: file("a.ts", "U") });

    expect(diff.original).toBe("blob HEAD:a.ts");
  });
});
