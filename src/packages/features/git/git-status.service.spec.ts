import type { DestroyRef } from "@angular/core";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import type { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitFile, GitFileStatus, GitStatusService, parseGitStatus } from "./git-status.service";

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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("GitStatusService", () => {
  function makeService(run: (request: SessionRunRequest) => Promise<SessionRunResult>): {
    service: GitStatusService;
    dispatch: ReturnType<typeof vi.fn>;
  } {
    const handle = {
      identity: { terminalId: "t1", sessionToken: "token" },
      mode: "following",
      cwd: "/c/repo/src",
      shellContext: { shellType: "Bash", backendOs: "linux" },
      contextRevision: 4,
      run: vi.fn(run),
      fs: { readTextFile: vi.fn(), normalizePath: (path: string) => path },
    } as unknown as BoundSessionHandle;
    const sessionApi: SessionApi = {
      boundSession$: new BehaviorSubject({ status: "active", session: handle }),
      cwdChanges$: new BehaviorSubject<void>(undefined),
    } as unknown as SessionApi;
    const dispatch = vi.fn();
    const notificationCenterPort = { dispatch } as unknown as NotificationCenterPort;
    const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
    return {
      service: new GitStatusService(sessionApi, notificationCenterPort, destroyRef),
      dispatch,
    };
  }

  function ran(stdout: string, exitCode = 0): SessionRunResult {
    return { status: "ran", result: { stdout, stderr: "", exitCode } };
  }

  it("derives the repo status by running git in the bound session", async () => {
    const { service } = makeService((request) => {
      const args = request.args ?? [];
      if (args.includes("--show-toplevel")) return Promise.resolve(ran("/c/repo\n"));
      if (args.includes("status")) return Promise.resolve(ran("M  a.ts\n?? b.ts\n"));
      if (args.includes("--abbrev-ref")) return Promise.resolve(ran("main\n"));
      return Promise.resolve(ran(""));
    });

    service.start();
    await flush();

    expect(service.gitError()).toBeNull();
    expect(service.status()).toMatchObject({
      gitRoot: "/c/repo",
      branch: "main",
      staged: [{ path: "a.ts", status: "M", isDirectory: false }],
      untracked: [{ path: "b.ts", status: "?", isDirectory: false }],
    });
  });

  it("reports 'unavailable' when the session refuses to run git (remote)", async () => {
    const { service } = makeService(() =>
      Promise.resolve({ status: "rejected", reason: "unknown-context" }),
    );

    service.start();
    await flush();

    expect(service.status()).toBeNull();
    expect(service.gitError()).toBe("unavailable");
  });
});
