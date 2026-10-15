import type { DestroyRef } from "@angular/core";
import type { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import type { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import type {
  TerminalActivityEvent,
  TerminalMonitorPort,
} from "@cogno/core/api/terminal-monitor-port";
import { BehaviorSubject, Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { GitRepositoryService } from "./git-repository.service";

type Run = (request: SessionRunRequest) => Promise<SessionRunResult>;

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const z = (...entries: string[]) => entries.map((entry) => `${entry}\0`).join("");
const f = (...fields: string[]) => fields.join("\x1f");

function ran(stdout: string, exitCode = 0): SessionRunResult {
  return { status: "ran", result: { stdout, stderr: "", exitCode } };
}

function sessionHandle(run: Run, terminalId = "t1", files: string[] = []): BoundSessionHandle {
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
      return Promise.resolve(ran(`${root}\n${root}/.git\n`));
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
    if (args[0] === "remote") return Promise.resolve(ran("origin\tgit@x:y.git (fetch)\n"));
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
  const destroyRef = { onDestroy: vi.fn() } as unknown as DestroyRef;
  return {
    service: new GitRepositoryService(sessionApi, monitor, destroyRef),
    bind: (next: BoundSessionHandle) => boundSession$.next({ status: "active", session: next }),
    activity$,
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
          "for-each-ref --format=%(refname)%1f%(objectname)%1f%(*objectname)%1f%(upstream:short)%1f%(upstream:track,nobracket)":
            ran(""),
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
    const { service } = makeService(sessionHandle(() => Promise.resolve(ran("", 128))));

    service.start();
    await flush();

    expect(service.error()).toBe("no_repo");
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
