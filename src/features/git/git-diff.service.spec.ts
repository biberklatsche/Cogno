import type { DestroyRef } from "@angular/core";
import type { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import type { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitDiffService } from "./git-diff.service";

describe("GitDiffService", () => {
  let run: ReturnType<typeof vi.fn>;
  let readTextFile: ReturnType<typeof vi.fn>;
  let service: GitDiffService;

  function ran(stdout: string): SessionRunResult {
    return { status: "ran", result: { stdout, stderr: "", exitCode: 0 } };
  }

  beforeEach(() => {
    run = vi.fn((request: SessionRunRequest) => {
      const revision = request.args?.at(-1) ?? "";
      if (revision.startsWith("HEAD:")) return Promise.resolve(ran("head content"));
      if (revision.startsWith(":0:")) return Promise.resolve(ran("index content"));
      return Promise.resolve(ran(""));
    });
    readTextFile = vi.fn().mockResolvedValue("working tree content");
    const handle = {
      identity: { terminalId: "t1", sessionToken: "token" },
      mode: "following",
      cwd: "/c/repo",
      shellContext: { shellType: "Bash", backendOs: "windows" },
      contextRevision: 1,
      run,
      fs: {
        readTextFile,
        normalizePath: (path: string) => `/normalized${path}`,
      },
    } as unknown as BoundSessionHandle;
    const sessionApi: SessionApi = {
      boundSession$: new BehaviorSubject({ status: "active", session: handle }),
      cwdChanges$: new BehaviorSubject<void>(undefined),
    } as unknown as SessionApi;
    const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
    service = new GitDiffService(sessionApi, destroyRef);
  });

  it("reads HEAD via the session and the working tree via fs for unstaged content", async () => {
    const diff = await service.loadDiff("src/file.ts", false, false, "/c/repo");

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: "git",
        args: ["-C", "/c/repo", "cat-file", "-p", "HEAD:src/file.ts"],
      }),
    );
    expect(readTextFile).toHaveBeenCalledWith("/normalized/c/repo/src/file.ts");
    expect(diff).toEqual({
      original: "head content",
      modified: "working tree content",
      language: "typescript",
    });
  });

  it("reads staged content from the index and never touches the working tree", async () => {
    const diff = await service.loadDiff("src/file.ts", true, false, "/c/repo");

    expect(readTextFile).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ args: ["-C", "/c/repo", "cat-file", "-p", ":0:src/file.ts"] }),
    );
    expect(diff.modified).toBe("index content");
  });
});
