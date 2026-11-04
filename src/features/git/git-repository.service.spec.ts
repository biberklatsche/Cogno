import type { DestroyRef } from "@angular/core";
import type { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import type { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import type {
  TerminalActivityEvent,
  TerminalMonitorPort,
} from "@cogno/core/api/terminal-monitor-port";
import type { AppWindow } from "@cogno/platform";
import { BehaviorSubject, Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { GitAvailability } from "./git-availability";
import { GitRepositoryService } from "./git-repository.service";
import { REF_FORMAT } from "./model/git-parsers";

type Run = (request: SessionRunRequest) => Promise<SessionRunResult>;

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const z = (...entries: string[]) => entries.map((entry) => `${entry}\0`).join("");
const f = (...fields: string[]) => fields.join("\x1f");

function ran(stdout: string, exitCode = 0, stderr = ""): SessionRunResult {
  return { status: "ran", result: { stdout, stderr, exitCode } };
}

function sessionHandle(
  run: Run,
  terminalId = "t1",
  files: string[] = [],
  gitDirChanges$: Subject<void> = new Subject<void>(),
): BoundSessionHandle {
  return {
    identity: { terminalId, sessionToken: "token" },
    mode: "following",
    cwd: "/c/repo/src",
    shellContext: { shellType: "Bash", backendOs: "linux" },
    contextRevision: 4,
    run: vi.fn(run),
    fs: {
      readTextFile: vi.fn((path: string) =>
        files.includes(path) ? Promise.resolve("x") : Promise.reject(new Error("missing")),
      ),
      normalizePath: (path: string) => path,
      watch$: vi.fn(() => gitDirChanges$),
    },
  } as unknown as BoundSessionHandle;
}

/** A repository at `root` on `main`, one staged file, one commit on main and origin/main. */
function repo(root: string, overrides: Record<string, SessionRunResult> = {}): Run {
  return (request) => {
    const args = (request.args ?? []).filter((arg) => arg !== "-C" && arg !== root);
    const command = args.slice(0, 2).join(" ");
    if (overrides[command]) return Promise.resolve(overrides[command]);
    if (args[0] === "rev-parse" && args.includes("--show-toplevel")) {
      return Promise.resolve(ran(`${root}\n${root}/.git\n.git\n`));
    }
    if (args[0] === "status") return Promise.resolve(ran(z("M  a.ts")));
    if (command === "rev-parse -q") return Promise.resolve(ran("c1\n"));
    if (args[0] === "symbolic-ref") return Promise.resolve(ran("main\n"));
    if (args[0] === "for-each-ref") {
      return Promise.resolve(
        ran(
          [
            f("refs/heads/main", "c1", "", "origin/main", ""),
            f("refs/remotes/origin/main", "c1", "", "", ""),
          ].join("\n"),
        ),
      );
    }
    if (args[0] === "remote" && args[1] === "get-url") return Promise.resolve(ran("git@x:y.git\n"));
    if (args[0] === "remote") return Promise.resolve(ran("origin\n"));
    if (args[0] === "log")
      return Promise.resolve(ran(`${f("c1", "", "Ana", "a@x", "1", "init")}\x1e`));
    return Promise.resolve(ran(""));
  };
}

function makeService(session: BoundSessionHandle) {
  const boundSession$ = new BehaviorSubject<unknown>({ status: "active", session });
  const activity$ = new Subject<TerminalActivityEvent>();
  const sessionApi = { boundSession$, cwdChanges$: new Subject<void>() } as unknown as SessionApi;
  const monitor = { activity$ } as unknown as TerminalMonitorPort;
  const focus$ = new Subject<boolean>();
  const appWindow = { onFocusChanged$: focus$ } as unknown as AppWindow;
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
  return {
    service: new GitRepositoryService(
      sessionApi,
      monitor,
      appWindow,
      new GitAvailability(),
      destroyRef,
    ),
    bind: (next: BoundSessionHandle) => boundSession$.next({ status: "active", session: next }),
    activity$,
    focus$,
  };
}

describe("GitRepositoryService", () => {
  it("reads the repository of the bound session with git", async () => {
    const { service } = makeService(sessionHandle(repo("/c/repo")));

    service.start();
    await flush();

    expect(service.error()).toBeNull();
    expect(service.root()).toBe("/c/repo");
    expect(service.head()).toEqual({ sha: "c1", branch: "main" });
    expect(service.status().staged).toEqual([{ path: "a.ts", status: "M", isDirectory: false }]);
    expect(service.refs().branches.map((b) => b.name)).toEqual(["main"]);
    expect(service.remotes()).toEqual([{ name: "origin", url: "git@x:y.git" }]);
    expect(service.commits().map((c) => c.sha)).toEqual(["c1"]);
    expect(service.refLabels().get("c1")).toEqual([
      { kind: "branch", name: "main", isHead: true, remotes: ["origin/main"] },
    ]);
  });

  it("stops asking git on focus, cwd and command events once git is missing", async () => {
    const session = sessionHandle(() => Promise.resolve(ran("", 127)));
    const { service, activity$, focus$ } = makeService(session);

    service.start();
    await flush();
    expect(service.error()).toBe("not_installed");
    expect(vi.mocked(session.run)).toHaveBeenCalledTimes(1);

    focus$.next(true);
    activity$.next({ terminalId: "t1", isBusy: false } as TerminalActivityEvent);
    await flush();
    expect(vi.mocked(session.run)).toHaveBeenCalledTimes(1);

    await service.refresh();
    expect(vi.mocked(session.run)).toHaveBeenCalledTimes(2);
  });

  it("runs every repository command in the repository root", async () => {
    const session = sessionHandle(repo("/c/repo"));
    const { service } = makeService(session);

    service.start();
    await flush();

    const calls = vi.mocked(session.run).mock.calls.map(([request]) => request.args ?? []);
    const repositoryCalls = calls.filter((args) => !args.includes("--show-toplevel"));
    expect(repositoryCalls.length).toBeGreaterThan(0);
    expect(repositoryCalls.every((args) => args[0] === "-C" && args[1] === "/c/repo")).toBe(true);
  });

  it("works in a repository without commits", async () => {
    const { service } = makeService(
      sessionHandle(
        repo("/c/new", {
          "rev-parse -q": ran("", 1),
          [`for-each-ref --format=${REF_FORMAT}`]: ran(""),
        }),
      ),
    );

    service.start();
    await flush();

    expect(service.error()).toBeNull();
    expect(service.head()).toEqual({ sha: null, branch: "main" });
    expect(service.commits()).toEqual([]);
  });

  it("follows a focus switch that happens while the previous repository is still being read", async () => {
    let answerFirst!: () => void;
    const first = repo("/c/first");
    const { service, bind } = makeService(
      sessionHandle(
        (request) =>
          new Promise((resolve) => {
            answerFirst = () => resolve(first(request));
          }),
      ),
    );

    service.start();
    bind(sessionHandle(repo("/c/second"), "t2"));
    answerFirst();
    await flush();
    await flush();

    expect(service.root()).toBe("/c/second");
  });

  it("reports 'unavailable' when the session refuses to run git (remote)", async () => {
    const { service } = makeService(
      sessionHandle(() => Promise.resolve({ status: "rejected", reason: "unknown-context" })),
    );

    service.start();
    await flush();

    expect(service.root()).toBeNull();
    expect(service.error()).toBe("unavailable");
  });

  it("reports 'no_repo' outside a repository", async () => {
    const { service } = makeService(
      sessionHandle(() =>
        Promise.resolve(
          ran("", 128, "fatal: not a git repository (or any of the parent directories): .git\n"),
        ),
      ),
    );

    service.start();
    await flush();

    expect(service.error()).toBe("no_repo");
    expect(service.errorDetail()).toBeNull();
  });

  it("tells a repository git refuses from a missing one, with git's reason", async () => {
    const reason =
      "fatal: detected dubious ownership in repository at '/c/repo'\n" +
      "To add an exception for this directory, call:\n\n" +
      "\tgit config --global --add safe.directory /c/repo\n";
    const session = sessionHandle(() => Promise.resolve(ran("", 128, reason)));
    const { service, focus$ } = makeService(session);

    service.start();
    await flush();

    expect(service.error()).toBe("repo_unreadable");
    expect(service.errorDetail()).toBe(reason.trim());
    // Git runs; the next focus asks again, the user may have fixed it.
    focus$.next(true);
    await flush();
    expect(vi.mocked(session.run)).toHaveBeenCalledTimes(2);
  });

  it("says so when git was ended for silence, and keeps asking", async () => {
    const session = sessionHandle(() =>
      Promise.resolve(ran("", 124, "Command showed no output for 60000ms and was ended")),
    );
    const { service, focus$ } = makeService(session);

    service.start();
    await flush();
    expect(service.error()).toBe("timed_out");
    expect(service.errorDetail()).toBe("Command showed no output for 60000ms and was ended");

    focus$.next(true);
    await flush();
    expect(vi.mocked(session.run)).toHaveBeenCalledTimes(2);
  });

  it("shows what git said when it is not usable", async () => {
    const { service } = makeService(
      sessionHandle(() =>
        Promise.resolve(ran("", 129, "error: unknown option `absolute-git-dir'")),
      ),
    );

    service.start();
    await flush();

    expect(service.error()).toBe("not_installed");
    expect(service.errorDetail()).toBe("error: unknown option `absolute-git-dir'");
  });

  it("shows why the status could not be read", async () => {
    const { service } = makeService(
      sessionHandle(
        repo("/c/repo", { "status --porcelain=v1": ran("", 128, "fatal: index file corrupt") }),
      ),
    );

    service.start();
    await flush();

    expect(service.error()).toBe("status_failed");
    expect(service.errorDetail()).toBe("fatal: index file corrupt");
  });

  it("says why the commit graph could not be read instead of showing it empty", async () => {
    const { service } = makeService(
      sessionHandle(repo("/c/repo", { "log --branches": ran("", 128, "fatal: bad object HEAD") })),
    );

    service.start();
    await flush();

    expect(service.error()).toBeNull();
    expect(service.head().branch).toBe("main");
    expect(service.logError()).toBe("fatal: bad object HEAD");
  });

  it("sees a merge git stopped in", async () => {
    const { service } = makeService(
      sessionHandle(repo("/c/repo"), "t1", ["/c/repo/.git/MERGE_HEAD"]),
    );

    service.start();
    await flush();

    expect(service.operation()).toBe("merge");
  });

  it("re-reads the repository when a command in the bound terminal finished", async () => {
    let staged = "M  a.ts";
    const base = repo("/c/repo");
    const { service, activity$ } = makeService(
      sessionHandle((request) =>
        request.args?.includes("status") ? Promise.resolve(ran(z(staged))) : base(request),
      ),
    );
    service.start();
    await flush();

    staged = "M  b.ts";
    activity$.next({ terminalId: "other", isBusy: false });
    await flush();
    expect(service.status().staged[0]?.path).toBe("a.ts");

    activity$.next({ terminalId: "t1", isBusy: false });
    await flush();
    expect(service.status().staged[0]?.path).toBe("b.ts");
  });

  it("re-reads the repository when the git dir changes on disk, until the panel closes", async () => {
    let staged = "M  a.ts";
    const base = repo("/c/repo");
    const gitDirChanges$ = new Subject<void>();
    const session = sessionHandle(
      (request) =>
        request.args?.includes("status") ? Promise.resolve(ran(z(staged))) : base(request),
      "t1",
      [],
      gitDirChanges$,
    );
    const { service } = makeService(session);
    service.start();
    await flush();
    expect(session.fs.watch$).toHaveBeenCalledWith("/c/repo/.git");

    staged = "M  b.ts";
    gitDirChanges$.next();
    await flush();
    expect(service.status().staged[0]?.path).toBe("b.ts");

    service.stop();
    expect(gitDirChanges$.observed).toBe(false);
  });

  it("watches the common git dir of a linked worktree, where the refs live", async () => {
    const base = repo("/c/wt");
    const session = sessionHandle((request) =>
      request.args?.includes("--show-toplevel")
        ? Promise.resolve(ran("/c/wt\n/c/repo/.git/worktrees/wt\n/c/repo/.git\n"))
        : base(request),
    );
    const { service } = makeService(session);

    service.start();
    await flush();

    expect(service.root()).toBe("/c/wt");
    expect(session.fs.watch$).toHaveBeenCalledTimes(1);
    expect(session.fs.watch$).toHaveBeenCalledWith("/c/repo/.git");
  });

  it("re-reads the repository when the window regains focus", async () => {
    let staged = "M  a.ts";
    const base = repo("/c/repo");
    const { service, focus$ } = makeService(
      sessionHandle((request) =>
        request.args?.includes("status") ? Promise.resolve(ran(z(staged))) : base(request),
      ),
    );
    service.start();
    await flush();

    staged = "M  b.ts";
    focus$.next(false);
    await flush();
    expect(service.status().staged[0]?.path).toBe("a.ts");

    focus$.next(true);
    await flush();
    expect(service.status().staged[0]?.path).toBe("b.ts");
  });

  it("loads a further page of commits on request", async () => {
    const session = sessionHandle(repo("/c/repo"));
    const { service } = makeService(session);
    service.start();
    await flush();

    await service.loadMoreCommits();

    const logLimits = vi
      .mocked(session.run)
      .mock.calls.map(([request]) => request.args ?? [])
      .filter((args) => args.includes("log"))
      .map((args) => args.find((arg) => /^-n\d+$/.test(arg)));
    expect(logLimits).toEqual(["-n1000", "-n2000"]);
  });
});
