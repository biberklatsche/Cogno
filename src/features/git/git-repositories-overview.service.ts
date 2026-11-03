import { computed, DestroyRef, effect, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SessionApi, SessionHandle } from "@cogno/core/api/session-api";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { TerminalPlacement, TerminalPlacementPort } from "@cogno/core/api/terminal-placement-port";
import { AppWindow } from "@cogno/platform";
import { TerminalId } from "@cogno/shared/domain";
import { filter } from "rxjs";
import { GitRepositoryService } from "./git-repository.service";
import { classifyRootFailure, READ_TIMEOUT_MS, runGit } from "./git-run";
import { countChanges, GitChangeCounts } from "./model/git-change-counts";
import { parseGitStatus } from "./model/git-parsers";

/** One open terminal that stands in a repository, as the repositories panel shows it. */
export type GitRepositoryTile = {
  readonly terminalId: TerminalId;
  readonly root: string;
  /** The checked-out branch; null when HEAD is detached or before the first commit. */
  readonly branch: string | null;
  readonly sha: string | null;
  readonly counts: GitChangeCounts;
  readonly placement: TerminalPlacement | undefined;
};

/** A refresh of one terminal that is running; another request meanwhile runs after it. */
type Refresh = { pending: boolean; readonly done: Promise<void> };

/**
 * The repositories of all open terminals, for the panel that lists them
 * beside the bound repository (ARCHITECTURE.md 3, `sessions$`). Each tile is
 * read with git in its own session - the right shell context, the session's
 * own cwd - and re-read when that session's cwd changes, a command in it
 * finishes, the window regains focus or the bound repository was re-read (a
 * commit from the panel runs no command in the terminal). A session that
 * refuses to run git (remote, not started yet) or stands outside a
 * repository has no tile.
 */
@Injectable({ providedIn: "root" })
export class GitRepositoriesOverviewService {
  private readonly tilesByTerminal = signal<ReadonlyMap<TerminalId, GitRepositoryTile>>(new Map());
  readonly tiles = computed(() => [...this.tilesByTerminal().values()]);

  private sessions = new Map<TerminalId, SessionHandle>();
  private readonly refreshes = new Map<TerminalId, Refresh>();
  private active = false;
  /** Git itself was not usable at the last look; no session asks again until the panel reopens. */
  private gitMissing = false;

  constructor(
    sessionApi: SessionApi,
    monitor: TerminalMonitorPort,
    private readonly placement: TerminalPlacementPort,
    appWindow: AppWindow,
    repository: GitRepositoryService,
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
    // The bound repository was re-read: its tile follows, so both agree after a
    // commit or stash made from the panel.
    effect(() => {
      if (repository.loading()) return;
      const terminalId = repository.currentSession()?.identity.terminalId;
      if (terminalId) void this.refreshTerminal(terminalId);
    });
    destroyRef.onDestroy(() => this.stop());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.gitMissing = false;
    void this.refreshAll();
  }

  stop(): void {
    this.active = false;
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
   * One terminal after the other: on a Mac without the command line tools
   * every git call pops Apple's install dialog, and the first answer stops
   * the rest.
   */
  private async refreshAll(): Promise<void> {
    for (const terminalId of this.sessions.keys()) {
      await this.refreshTerminal(terminalId);
    }
  }

  /** Re-read one terminal; a request while it runs is not dropped but runs after it. */
  private refreshTerminal(terminalId: TerminalId): Promise<void> {
    if (!this.active || this.gitMissing || !this.sessions.has(terminalId)) {
      return Promise.resolve();
    }
    const running = this.refreshes.get(terminalId);
    if (running) {
      running.pending = true;
      return running.done;
    }
    const refresh: { pending: boolean; done: Promise<void> } = {
      pending: false,
      done: Promise.resolve(),
    };
    refresh.done = (async () => {
      try {
        do {
          refresh.pending = false;
          const session = this.sessions.get(terminalId);
          if (!session || !this.active || this.gitMissing) return;
          await this.read(session);
        } while (refresh.pending);
      } finally {
        this.refreshes.delete(terminalId);
      }
    })();
    this.refreshes.set(terminalId, refresh);
    return refresh.done;
  }

  private async read(session: SessionHandle): Promise<void> {
    const { terminalId } = session;
    // Runs in the session's cwd to find the repository it is in.
    const toplevel = await runGit(session, ["rev-parse", "--show-toplevel"], READ_TIMEOUT_MS);
    if (!toplevel) {
      this.drop(terminalId);
      return;
    }
    const root = toplevel.stdout.trim();
    if (toplevel.exitCode !== 0 || !root) {
      const failure = classifyRootFailure(toplevel.exitCode, toplevel.stderr);
      if (failure === "not_installed") this.gitMissing = true;
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
    if (!this.tilesByTerminal().has(terminalId)) return;
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
