import { computed, DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SessionApi, SessionHandle } from "@cogno/core/api/session-api";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { TerminalPlacement, TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { AppWindow } from "@cogno/platform";
import { TerminalId } from "@cogno/shared/domain";
import { filter } from "rxjs";
import { GitAvailability } from "./git-availability";
import { GitRepositoryService } from "./git-repository.service";
import { classifyRootFailure, READ_TIMEOUT_MS, runGit } from "./git-run";
import { countChanges, GitChangeCounts } from "./model/git-change-counts";
import { parseGitStatus } from "./model/git-parsers";

/** One open terminal that stands in a repository. */
type TerminalRepository = {
  readonly terminalId: TerminalId;
  readonly root: string;
  /** The checked-out branch; null when HEAD is detached or before the first commit. */
  readonly branch: string | null;
  readonly sha: string | null;
  readonly counts: GitChangeCounts;
  readonly placement: TerminalPlacement | undefined;
};

/**
 * A repository as the repositories panel shows it: all terminals of one
 * workspace that stand in it, in tab order, share one tile, which shows the
 * placement of the first.
 */
export type GitRepositoryTile = Omit<TerminalRepository, "terminalId"> & {
  readonly terminalIds: ReadonlyArray<TerminalId>;
};

/** A refresh of one terminal that is running; a request meanwhile makes it run once more. */
type Refresh = { pending: boolean; readonly done: Promise<void> };

/**
 * The repositories of all open terminals, for the panel that lists them
 * beside the bound repository (ARCHITECTURE.md 3, `sessions$`). Each tile is
 * read with git in its own session - the right shell context, the session's
 * own cwd - and re-read when that session's cwd changes, a command in it
 * finishes, the window regains focus or the panel re-read the bound
 * repository on its own account (a commit from the panel runs no command in
 * the terminal). A session that refuses to run git (remote, not started yet)
 * or stands outside a repository has no tile.
 */
@Injectable({ providedIn: "root" })
export class GitRepositoriesOverviewService {
  private readonly tilesByTerminal = signal<ReadonlyMap<TerminalId, TerminalRepository>>(new Map());
  readonly tiles = computed(() => mergeSameRepository([...this.tilesByTerminal().values()]));

  private sessions = new Map<TerminalId, SessionHandle>();
  private readonly refreshes = new Map<TerminalId, Refresh>();
  private active = false;
  /** Git answered at least once since the panel opened; see `refreshAll`. */
  private gitRan = false;

  constructor(
    sessionApi: SessionApi,
    monitor: TerminalMonitorPort,
    private readonly placement: TerminalPlacementPort,
    appWindow: AppWindow,
    repository: GitRepositoryService,
    private readonly availability: GitAvailability,
    destroyRef: DestroyRef,
  ) {
    sessionApi.sessions$.pipe(takeUntilDestroyed(destroyRef)).subscribe((sessions) => {
      this.onSessions(sessions);
    });
    monitor.cwdChanges$.pipe(takeUntilDestroyed(destroyRef)).subscribe(({ terminalId }) => {
      void this.refreshTerminal(terminalId);
    });
    monitor.activity$
      .pipe(
        filter((event) => !event.isBusy),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(({ terminalId }) => {
        void this.refreshTerminal(terminalId);
      });
    placement.changes$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.readPlacements();
    });
    appWindow.onFocusChanged$
      .pipe(
        filter((focused) => focused),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        void this.refreshAll();
      });
    // A commit or stash made from the panel runs no command in the terminal;
    // the bound tile follows the panel's own re-read so both agree.
    repository.explicitRefreshes$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      const terminalId = repository.currentSession()?.identity.terminalId;
      if (terminalId) void this.refreshTerminal(terminalId);
    });
    destroyRef.onDestroy(() => this.stop());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.gitRan = false;
    void this.refreshAll();
  }

  stop(): void {
    this.active = false;
  }

  /** Re-read every terminal, asking git again even if it was missing. */
  refresh(): Promise<void> {
    this.availability.reset();
    return this.refreshAll();
  }

  private onSessions(sessions: ReadonlyArray<SessionHandle>): void {
    const before = this.sessions;
    this.sessions = new Map(sessions.map((session) => [session.terminalId, session]));
    const gone = [...before.keys()].filter((terminalId) => !this.sessions.has(terminalId));
    if (gone.length > 0) {
      this.tilesByTerminal.update((tiles) => {
        const next = new Map(tiles);
        for (const terminalId of gone) next.delete(terminalId);
        return next;
      });
    }
    for (const terminalId of this.sessions.keys()) {
      if (!before.has(terminalId)) void this.refreshTerminal(terminalId);
    }
  }

  /**
   * Terminals are read one after the other until git has answered once: on
   * a Mac without the command line tools every git call pops Apple's install
   * dialog, and one is enough. From then on they are read side by side, so
   * one slow repository does not hold up the tiles of the others.
   */
  private async refreshAll(): Promise<void> {
    const parallel: Promise<void>[] = [];
    for (const terminalId of this.sessions.keys()) {
      if (this.gitRan) parallel.push(this.refreshTerminal(terminalId));
      else await this.refreshTerminal(terminalId);
    }
    await Promise.all(parallel);
  }

  /** Re-read one terminal; a request while it runs is not dropped but runs after it. */
  private refreshTerminal(terminalId: TerminalId): Promise<void> {
    if (!this.active || this.availability.missing || !this.sessions.has(terminalId)) {
      return Promise.resolve();
    }
    const running = this.refreshes.get(terminalId);
    if (running) {
      running.pending = true;
      return running.done;
    }
    const refresh = { pending: false };
    const done = (async () => {
      try {
        do {
          refresh.pending = false;
          const session = this.sessions.get(terminalId);
          if (!session || !this.active || this.availability.missing) return;
          await this.read(session);
        } while (refresh.pending);
      } finally {
        this.refreshes.delete(terminalId);
      }
    })();
    this.refreshes.set(terminalId, Object.assign(refresh, { done }));
    return done;
  }

  private async read(session: SessionHandle): Promise<void> {
    const { terminalId } = session;
    // Runs in the session's cwd to find the repository it is in.
    const toplevel = await runGit(session, ["rev-parse", "--show-toplevel"], READ_TIMEOUT_MS);
    if (!toplevel) {
      this.drop(terminalId);
      return;
    }
    this.gitRan = true;
    const root = toplevel.stdout.trim();
    if (toplevel.exitCode !== 0 || !root) {
      const failure = classifyRootFailure(toplevel.exitCode, toplevel.stderr);
      if (failure === "not_installed") this.availability.markMissing();
      this.drop(terminalId);
      return;
    }
    const git = (args: ReadonlyArray<string>) =>
      runGit(session, ["-C", root, ...args], READ_TIMEOUT_MS);
    const [branch, sha, status] = await Promise.all([
      git(["symbolic-ref", "-q", "--short", "HEAD"]),
      git(["rev-parse", "-q", "--verify", "HEAD"]),
      git(["status", "--porcelain=v1", "-z", "--untracked-files=normal"]),
    ]);
    if (!branch || !sha || !status || status.exitCode !== 0) {
      this.drop(terminalId);
      return;
    }
    // Closed meanwhile: the tiles stay as they were when the panel went away.
    if (!this.active) return;
    this.tilesByTerminal.update((tiles) =>
      new Map(tiles).set(terminalId, {
        terminalId,
        root,
        branch: branch.exitCode === 0 ? branch.stdout.trim() || null : null,
        sha: sha.exitCode === 0 ? sha.stdout.trim() || null : null,
        counts: countChanges(parseGitStatus(status.stdout)),
        placement: this.placement.getPlacement(terminalId),
      }),
    );
  }

  private drop(terminalId: TerminalId): void {
    if (!this.active || !this.tilesByTerminal().has(terminalId)) return;
    this.tilesByTerminal.update((tiles) => {
      const next = new Map(tiles);
      next.delete(terminalId);
      return next;
    });
  }

  private readPlacements(): void {
    if (this.tilesByTerminal().size === 0) return;
    this.tilesByTerminal.update(
      (tiles) =>
        new Map(
          [...tiles].map(([terminalId, tile]) => [
            terminalId,
            { ...tile, placement: this.placement.getPlacement(terminalId) },
          ]),
        ),
    );
  }
}

/** One tile per repository and workspace, in tab order; its first terminal gives the placement. */
function mergeSameRepository(repositories: ReadonlyArray<TerminalRepository>): GitRepositoryTile[] {
  const byKey = new Map<string, GitRepositoryTile>();
  const inTabOrder = [...repositories].sort(
    (a, b) =>
      (a.placement?.tabIndex ?? Number.MAX_SAFE_INTEGER) -
      (b.placement?.tabIndex ?? Number.MAX_SAFE_INTEGER),
  );
  for (const { terminalId, ...repository } of inTabOrder) {
    const key = `${repository.placement?.workspaceId ?? ""}\0${repository.root}`;
    const tile = byKey.get(key);
    byKey.set(
      key,
      tile
        ? { ...tile, terminalIds: [...tile.terminalIds, terminalId] }
        : { ...repository, terminalIds: [terminalId] },
    );
  }
  return [...byKey.values()];
}
