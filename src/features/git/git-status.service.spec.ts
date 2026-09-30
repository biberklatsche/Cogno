import type { DestroyRef } from "@angular/core";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import type { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { GitFile, GitFileStatus, GitStatusService, parseGitStatus } from "./git-status.service";

function expectedGitFile(path: string, status: GitFileStatus, isDirectory = false): GitFile {
  return { path, status, isDirectory };
}

/** `git status --porcelain=v1 -z` output: every entry ends in NUL. */
const z = (...entries: string[]) => entries.map((entry) => `${entry}\0`).join("");

describe("parseGitStatus", () => {
  it("returns empty lists for empty input", () => {
    expect(parseGitStatus("")).toEqual({ staged: [], unstaged: [], untracked: [] });
  });

  it("classifies a modified staged file", () => {
    const result = parseGitStatus(z("M  src/foo.ts"));
    expect(result.staged).toEqual([expectedGitFile("src/foo.ts", "M")]);
    expect(result.unstaged).toEqual([]);
  });

  it("classifies a modified unstaged file", () => {
    const result = parseGitStatus(z(" M src/foo.ts"));
    expect(result.unstaged).toEqual([expectedGitFile("src/foo.ts", "M")]);
    expect(result.staged).toEqual([]);
  });

  it("classifies an untracked file", () => {
    const result = parseGitStatus(z("?? new-file.ts"));
    expect(result.untracked).toEqual([expectedGitFile("new-file.ts", "?")]);
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
  });

  it("classifies an added staged file", () => {
    const result = parseGitStatus(z("A  src/new.ts"));
    expect(result.staged).toEqual([expectedGitFile("src/new.ts", "A")]);
  });

  it("classifies a deleted staged file", () => {
    const result = parseGitStatus(z("D  src/old.ts"));
    expect(result.staged).toEqual([expectedGitFile("src/old.ts", "D")]);
  });

  it("classifies a file that is both staged and has unstaged changes (AM)", () => {
    const result = parseGitStatus(z("AM src/foo.ts"));
    expect(result.staged).toEqual([expectedGitFile("src/foo.ts", "A")]);
    expect(result.unstaged).toEqual([expectedGitFile("src/foo.ts", "M")]);
  });

  it("takes the new path of a rename and skips its source entry", () => {
    // Real output of `git mv "old name.txt" "new name.txt"` next to a modified file.
    const result = parseGitStatus(z("R  new name.txt", "old name.txt", " M plain.txt"));
    expect(result.staged).toEqual([expectedGitFile("new name.txt", "R")]);
    expect(result.unstaged).toEqual([expectedGitFile("plain.txt", "M")]);
  });

  it("keeps spaces and non-ASCII characters in paths as they are", () => {
    const result = parseGitStatus(z("?? neu ä.txt", " M my file.txt"));
    expect(result.untracked).toEqual([expectedGitFile("neu ä.txt", "?")]);
    expect(result.unstaged).toEqual([expectedGitFile("my file.txt", "M")]);
  });

  it("falls back to M for unknown status characters", () => {
    const result = parseGitStatus(z("U  src/conflict.ts"));
    expect(result.staged).toEqual([expectedGitFile("src/conflict.ts", "M")]);
  });

  it("handles multiple files with mixed states", () => {
    const result = parseGitStatus(
      z(
        "M  staged-modified.ts",
        " M unstaged-modified.ts",
        "A  staged-added.ts",
        "?? untracked.ts",
      ),
    );
    expect(result.staged).toEqual([
      expectedGitFile("staged-modified.ts", "M"),
      expectedGitFile("staged-added.ts", "A"),
    ]);
    expect(result.unstaged).toEqual([expectedGitFile("unstaged-modified.ts", "M")]);
    expect(result.untracked).toEqual([expectedGitFile("untracked.ts", "?")]);
  });
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("GitStatusService", () => {
  type Run = (request: SessionRunRequest) => Promise<SessionRunResult>;

  function sessionHandle(run: Run): BoundSessionHandle {
    return {
      identity: { terminalId: "t1", sessionToken: "token" },
      mode: "following",
      cwd: "/c/repo/src",
      shellContext: { shellType: "Bash", backendOs: "linux" },
      contextRevision: 4,
      run: vi.fn(run),
      fs: { readTextFile: vi.fn(), normalizePath: (path: string) => path },
    } as unknown as BoundSessionHandle;
  }

  function makeService(run: Run): {
    service: GitStatusService;
    dispatch: ReturnType<typeof vi.fn>;
    /** Focuses another terminal, whose session runs git with `run`. */
    bind: (run: Run) => void;
  } {
    const boundSession$ = new BehaviorSubject({ status: "active", session: sessionHandle(run) });
    const sessionApi: SessionApi = {
      boundSession$,
      cwdChanges$: new BehaviorSubject<void>(undefined),
    } as unknown as SessionApi;
    const dispatch = vi.fn();
    const notificationCenterPort = { dispatch } as unknown as NotificationCenterPort;
    const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
    return {
      service: new GitStatusService(sessionApi, notificationCenterPort, destroyRef),
      dispatch,
      bind: (next) => boundSession$.next({ status: "active", session: sessionHandle(next) }),
    };
  }

  /** A repo at `root` on branch main with one staged file. */
  function repo(root: string): Run {
    return (request) => {
      const args = request.args ?? [];
      if (args.includes("--show-toplevel")) return Promise.resolve(ran(`${root}\n`));
      if (args.includes("status")) return Promise.resolve(ran(z("M  a.ts")));
      if (args.includes("--abbrev-ref")) return Promise.resolve(ran("main\n"));
      return Promise.resolve(ran(""));
    };
  }

  function ran(stdout: string, exitCode = 0): SessionRunResult {
    return { status: "ran", result: { stdout, stderr: "", exitCode } };
  }

  it("derives the repo status by running git in the bound session", async () => {
    const { service } = makeService((request) => {
      const args = request.args ?? [];
      if (args.includes("--show-toplevel")) return Promise.resolve(ran("/c/repo\n"));
      if (args.includes("status")) return Promise.resolve(ran(z("M  a.ts", "?? b.ts")));
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

  it("follows a focus switch that happens while the previous repo is still being resolved", async () => {
    let answerFirstRepo!: () => void;
    const firstRepo = repo("/c/first");
    const { service, bind } = makeService(
      (request) =>
        new Promise((resolve) => {
          answerFirstRepo = () => resolve(firstRepo(request));
        }),
    );

    service.start();
    bind(repo("/c/second"));
    answerFirstRepo();
    await flush();

    expect(service.status()?.gitRoot).toBe("/c/second");
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
