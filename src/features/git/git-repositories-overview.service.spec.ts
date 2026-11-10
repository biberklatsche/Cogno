import type { DestroyRef } from "@angular/core";
import type { SessionApi, SessionHandle } from "@cogno/core/api/session-api";
import type { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import type {
  TerminalActivityEvent,
  TerminalCwdChangeEvent,
  TerminalMonitorPort,
} from "@cogno/core/api/terminal-monitor-port";
import type { TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import type { AppWindow } from "@cogno/platform";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitAvailability } from "./git-availability";
import { GitRepositoriesOverviewService } from "./git-repositories-overview.service";
import type { GitRepositoryService } from "./git-repository.service";

type Run = (request: SessionRunRequest) => Promise<SessionRunResult>;

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const z = (...entries: string[]) => entries.map((entry) => `${entry}\0`).join("");

function ran(stdout: string, exitCode = 0, stderr = ""): SessionRunResult {
  return { status: "ran", result: { stdout, stderr, exitCode } };
}

/** A terminal in a repository at `root` on `branch`, with the given porcelain status. */
function repo(root: string, branch: string, status: string): Run {
  return (request) => {
    const args = (request.args ?? []).filter((arg) => arg !== "-C" && arg !== root);
    if (args.includes("--show-toplevel")) return Promise.resolve(ran(`${root}\n`));
    if (args[0] === "symbolic-ref") return Promise.resolve(ran(`${branch}\n`));
    if (args[0] === "rev-parse") return Promise.resolve(ran("c1\n"));
    if (args[0] === "status") return Promise.resolve(ran(status));
    return Promise.resolve(ran(""));
  };
}

const noRepo: Run = () => Promise.resolve(ran("", 128, "fatal: not a git repository"));
const rejected: Run = () => Promise.resolve({ status: "rejected", reason: "unknown-context" });

function session(terminalId: string, run: Run): SessionHandle {
  return { terminalId, contextRevision: 1, run: vi.fn(run) };
}

describe("GitRepositoriesOverviewService", () => {
  let sessions$: BehaviorSubject<ReadonlyArray<SessionHandle>>;
  let cwdChanges$: Subject<TerminalCwdChangeEvent>;
  let activity$: Subject<TerminalActivityEvent>;
  let placementChanges$: Subject<void>;
  let focus$: Subject<boolean>;
  let explicitRefreshes$: Subject<void>;
  let boundTerminalId: string | null;
  let availability: GitAvailability;
  let getPlacement: ReturnType<typeof vi.fn>;
  let service: GitRepositoriesOverviewService;

  beforeEach(() => {
    sessions$ = new BehaviorSubject<ReadonlyArray<SessionHandle>>([]);
    cwdChanges$ = new Subject();
    activity$ = new Subject();
    placementChanges$ = new Subject();
    focus$ = new Subject();
    explicitRefreshes$ = new Subject();
    availability = new GitAvailability();
    boundTerminalId = null;
    getPlacement = vi.fn((terminalId: string) => ({
      workspaceId: "w1",
      workspaceName: "Work",
      workspaceColor: "blue",
      workspacePosition: 0,
      tabTitle: `tab ${terminalId}`,
      tabIndex: 0,
    }));
    service = new GitRepositoriesOverviewService(
      { sessions$ } as unknown as SessionApi,
      { cwdChanges$, activity$ } as unknown as TerminalMonitorPort,
      { getPlacement, changes$: placementChanges$ } as unknown as TerminalPlacementPort,
      { onFocusChanged$: focus$ } as unknown as AppWindow,
      {
        explicitRefreshes$,
        currentSession: () =>
          boundTerminalId ? { identity: { terminalId: boundTerminalId } } : null,
      } as unknown as GitRepositoryService,
      availability,
      { onDestroy: vi.fn() } as unknown as DestroyRef,
    );
  });

  it("shows a tile per terminal in a repository, with branch, counts and placement", async () => {
    sessions$.next([
      session("t1", repo("/c/app", "main", z("M  a.ts", "A  b.ts", " D c.ts", "?? d.ts"))),
      session("t2", noRepo),
      session("t3", rejected),
    ]);

    service.start();
    await flush();

    expect(service.tiles()).toEqual([
      {
        terminalIds: ["t1"],
        root: "/c/app",
        branch: "main",
        sha: "c1",
        counts: { added: 2, modified: 1, deleted: 1 },
        placement: expect.objectContaining({ tabTitle: "tab t1" }),
      },
    ]);
  });

  it("merges terminals of one workspace in the same repository into one tile, in tab order", async () => {
    const tabs: Record<string, { workspaceId: string; tabIndex: number }> = {
      t1: { workspaceId: "w1", tabIndex: 2 },
      t2: { workspaceId: "w1", tabIndex: 0 },
      t3: { workspaceId: "w2", tabIndex: 3 },
      t4: { workspaceId: "w1", tabIndex: 1 },
    };
    getPlacement.mockImplementation((terminalId: string) => ({
      workspaceName: "Work",
      workspacePosition: 0,
      tabTitle: `tab ${terminalId}`,
      ...tabs[terminalId],
    }));
    sessions$.next([
      session("t1", repo("/c/app", "main", "")),
      session("t2", repo("/c/app", "main", "")),
      session("t3", repo("/c/app", "main", "")),
      session("t4", repo("/c/other", "main", "")),
    ]);

    service.start();
    await flush();

    expect(
      service.tiles().map((tile) => [tile.root, tile.terminalIds, tile.placement?.tabTitle]),
    ).toEqual([
      ["/c/app", ["t2", "t1"], "tab t2"],
      ["/c/other", ["t4"], "tab t4"],
      ["/c/app", ["t3"], "tab t3"],
    ]);
  });

  it("does nothing while the panel is closed, and drops the tile of a session that ended", async () => {
    const t1 = session("t1", repo("/c/app", "main", ""));
    sessions$.next([t1]);
    await flush();
    expect(t1.run).not.toHaveBeenCalled();

    service.start();
    await flush();
    expect(service.tiles().flatMap((tile) => tile.terminalIds)).toEqual(["t1"]);

    sessions$.next([]);
    expect(service.tiles()).toEqual([]);
  });

  it("re-reads a terminal when its cwd changes or a command in it finishes", async () => {
    let branch = "main";
    const t1 = session("t1", (request) => repo("/c/app", branch, "")(request));
    sessions$.next([t1]);
    service.start();
    await flush();

    branch = "feature";
    cwdChanges$.next({ terminalId: "t1", cwd: "/c/app/src" });
    await flush();
    expect(service.tiles()[0]?.branch).toBe("feature");

    branch = "fix";
    activity$.next({ terminalId: "t1", isBusy: false });
    await flush();
    expect(service.tiles()[0]?.branch).toBe("fix");
  });

  it("follows the panel's own re-read of the bound repository, so a commit from the panel shows", async () => {
    let status = z("M  a.ts");
    const t1 = session("t1", (request) => repo("/c/app", "main", status)(request));
    sessions$.next([t1]);
    service.start();
    await flush();
    expect(service.tiles()[0]?.counts.modified).toBe(1);

    status = "";
    boundTerminalId = "t1";
    explicitRefreshes$.next();
    await flush();

    expect(service.tiles()[0]?.counts.modified).toBe(0);
  });

  it("re-reads placements without asking git when tabs or workspaces change", async () => {
    const t1 = session("t1", repo("/c/app", "main", ""));
    sessions$.next([t1]);
    service.start();
    await flush();
    const calls = vi.mocked(t1.run).mock.calls.length;

    getPlacement.mockReturnValue({
      workspaceId: "w1",
      workspaceName: "Work",
      workspaceColor: "blue",
      workspacePosition: 0,
      tabTitle: "renamed",
      tabIndex: 2,
    });
    placementChanges$.next();

    expect(service.tiles()[0]?.placement?.tabTitle).toBe("renamed");
    expect(vi.mocked(t1.run).mock.calls.length).toBe(calls);
  });

  it("stops asking once git itself is missing, until an explicit refresh", async () => {
    let exitCode = 127;
    const missing = session("t1", () => Promise.resolve(ran("", exitCode)));
    const other = session("t2", repo("/c/app", "main", ""));
    sessions$.next([missing, other]);

    service.start();
    await flush();
    expect(availability.missing).toBe(true);
    expect(service.tiles()).toEqual([]);
    expect(other.run).not.toHaveBeenCalled();

    exitCode = 128;
    await service.refresh();
    expect(service.tiles().flatMap((tile) => tile.terminalIds)).toEqual(["t2"]);
  });

  it("keeps the other terminals when one terminal's git timed out", async () => {
    const slow = session("t1", () => Promise.resolve(ran("", 124, "no output for 60000ms")));
    const other = session("t2", repo("/c/app", "main", ""));
    sessions$.next([slow, other]);

    service.start();
    await flush();

    expect(availability.missing).toBe(false);
    expect(service.tiles().flatMap((tile) => tile.terminalIds)).toEqual(["t2"]);
  });

  it("reads terminals one after the other until git answered once, then side by side", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slowRepo = (id: string): Run => {
      const inner = repo(`/c/${id}`, "main", "");
      return async (request) => {
        // One entry per terminal: the first call is the one that finds the repository.
        if (request.args?.includes("--show-toplevel")) order.push(id);
        await gate;
        return inner(request);
      };
    };
    sessions$.next([
      session("t1", slowRepo("t1")),
      session("t2", slowRepo("t2")),
      session("t3", slowRepo("t3")),
    ]);

    service.start();
    await flush();
    // The first terminal has git on the line; the others wait for its answer.
    expect(order).toEqual(["t1"]);

    release();
    await flush();
    await flush();
    expect(order).toEqual(["t1", "t2", "t3"]);
    expect(
      service
        .tiles()
        .flatMap((tile) => tile.terminalIds)
        .sort(),
    ).toEqual(["t1", "t2", "t3"]);
  });

  it("writes no tile after the panel closed", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = repo("/c/app", "main", "");
    sessions$.next([
      session("t1", async (request) => {
        await gate;
        return inner(request);
      }),
    ]);

    service.start();
    service.stop();
    release();
    await flush();
    await flush();

    expect(service.tiles()).toEqual([]);
  });
});
