import { computed, DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  CommandRunner,
  NotificationCenterPort,
  ShellContextContract,
  TerminalGateway,
} from "@cogno/core-api";
import { merge } from "rxjs";

export type GitFileStatus = "M" | "A" | "D" | "R" | "?";

export type GitFile = {
  readonly path: string;
  readonly status: GitFileStatus;
};

export type GitStatus = {
  readonly gitRoot: string;
  readonly branch: string;
  readonly staged: ReadonlyArray<GitFile>;
  readonly unstaged: ReadonlyArray<GitFile>;
  readonly untracked: ReadonlyArray<GitFile>;
};

export type GitError = "not_installed" | "no_repo";

@Injectable({ providedIn: "root" })
export class GitStatusService {
  private static readonly POLL_INTERVAL_MS = 2500;

  private readonly gitStatusSignal = signal<GitStatus | null>(null);
  private readonly gitErrorSignal = signal<GitError | null>(null);
  private readonly loadingSignal = signal(false);

  readonly status = this.gitStatusSignal.asReadonly();
  readonly gitError = this.gitErrorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly stagedCount = computed(() => this.gitStatusSignal()?.staged.length ?? 0);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private currentGitRoot: string | null = null;
  private _currentShellContext: ShellContextContract | null = null;
  private refreshContextInFlight = false;

  get currentShellContext(): ShellContextContract | null {
    return this._currentShellContext;
  }

  constructor(
    private readonly terminalGateway: TerminalGateway,
    private readonly commandRunner: CommandRunner,
    private readonly notificationCenterPort: NotificationCenterPort,
    destroyRef: DestroyRef,
  ) {
    merge(this.terminalGateway.focusedTerminalId$, this.terminalGateway.cwdChanges$)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (this.pollTimer !== null) void this.refreshContext();
      });

    destroyRef.onDestroy(() => this.stopPolling());
  }

  startPolling(): void {
    if (this.pollTimer !== null) return;
    void this.refreshContext();
    this.pollTimer = setInterval(() => {
      void this.refreshContext();
    }, GitStatusService.POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async stageFile(filePath: string): Promise<void> {
    await this.runGitCommand(["add", "--", filePath], "Stage failed");
  }

  async unstageFile(filePath: string): Promise<void> {
    await this.runGitCommand(["restore", "--staged", "--", filePath], "Unstage failed");
  }

  async stageAll(): Promise<void> {
    await this.runGitCommand(["add", "-A"], "Stage all failed");
  }

  async unstageAll(): Promise<void> {
    await this.runGitCommand(["restore", "--staged", "."], "Unstage all failed");
  }

  async discardFileChanges(filePath: string): Promise<void> {
    await this.runGitCommand(["restore", "--", filePath], "Discard failed");
  }

  async commit(message: string): Promise<void> {
    if (!this.currentGitRoot || !this.currentShellContext) return;
    const result = await this.commandRunner.run({
      cwd: this.currentGitRoot,
      shellContext: this.currentShellContext,
      program: "git",
      args: ["commit", "-m", message],
      timeoutMs: 15_000,
    });

    if (result.exitCode !== 0) {
      this.notificationCenterPort.dispatch({
        header: "Commit failed",
        body: result.stderr.trim() || result.stdout.trim(),
        type: "error",
        source: "git",
        channels: { toast: true },
      });
      return;
    }

    const firstLine = result.stdout.split("\n")[0]?.trim() ?? "";
    this.notificationCenterPort.dispatch({
      header: "Committed",
      body: firstLine,
      type: "success",
      source: "git",
      channels: { toast: true },
    });

    await this.refreshStatus();
  }

  private async refreshContext(): Promise<void> {
    if (this.refreshContextInFlight) return;
    this.refreshContextInFlight = true;
    try {
      const snapshot = await this.terminalGateway.captureFocusedSnapshot();
      if (!snapshot?.cwd || !snapshot.shellContext) {
        this.gitStatusSignal.set(null);
        this.gitErrorSignal.set(null);
        this.currentGitRoot = null;
        this._currentShellContext = null;
        return;
      }

      this._currentShellContext = snapshot.shellContext;
      const result = await this.detectGitRoot(snapshot.cwd, snapshot.shellContext);
      this.currentGitRoot = result.gitRoot;

      if (!result.gitRoot) {
        this.gitStatusSignal.set(null);
        this.gitErrorSignal.set(result.error);
        return;
      }

      this.gitErrorSignal.set(null);
      await this.refreshStatus();
    } finally {
      this.refreshContextInFlight = false;
    }
  }

  async refreshStatus(): Promise<void> {
    if (!this.currentGitRoot || !this.currentShellContext) return;
    this.loadingSignal.set(true);
    try {
      const [statusResult, branchResult] = await Promise.all([
        this.commandRunner.run({
          cwd: this.currentGitRoot,
          shellContext: this.currentShellContext,
          program: "git",
          args: ["status", "--porcelain=v1", "--untracked-files=all"],
          timeoutMs: 5_000,
        }),
        this.commandRunner.run({
          cwd: this.currentGitRoot,
          shellContext: this.currentShellContext,
          program: "git",
          args: ["rev-parse", "--abbrev-ref", "HEAD"],
          timeoutMs: 5_000,
        }),
      ]);

      if (statusResult.exitCode !== 0) {
        this.gitStatusSignal.set(null);
        return;
      }

      const parsed = parseGitStatus(statusResult.stdout);
      this.gitStatusSignal.set({
        gitRoot: this.currentGitRoot,
        branch: branchResult.stdout.trim() || "HEAD",
        ...parsed,
      });
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async detectGitRoot(
    cwd: string,
    shellContext: ShellContextContract,
  ): Promise<{ gitRoot: string; error: null } | { gitRoot: null; error: GitError }> {
    const result = await this.commandRunner.run({
      cwd,
      shellContext,
      program: "git",
      args: ["rev-parse", "--show-toplevel"],
      timeoutMs: 5_000,
    });

    if (result.exitCode === 0) {
      const root = result.stdout.trim();
      return root ? { gitRoot: root, error: null } : { gitRoot: null, error: "no_repo" };
    }

    const combined = `${result.stdout} ${result.stderr}`.toLowerCase();
    const error: GitError = combined.includes("not a git repository") ? "no_repo" : "not_installed";
    return { gitRoot: null, error };
  }

  private async runGitCommand(args: string[], errorHeader: string): Promise<void> {
    if (!this.currentGitRoot || !this.currentShellContext) return;
    const result = await this.commandRunner.run({
      cwd: this.currentGitRoot,
      shellContext: this.currentShellContext,
      program: "git",
      args,
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) {
      this.notificationCenterPort.dispatch({
        header: errorHeader,
        body: result.stderr.trim() || result.stdout.trim(),
        type: "error",
        source: "git",
        channels: { toast: true },
      });
      return;
    }
    await this.refreshStatus();
  }

}

export function parseGitStatus(raw: string): Pick<GitStatus, "staged" | "unstaged" | "untracked"> {
  const staged: GitFile[] = [];
  const unstaged: GitFile[] = [];
  const untracked: GitFile[] = [];

  for (const line of raw.split("\n")) {
    if (line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    // porcelain v1 rename lines are "R new\told" — take only the new path
    const path = line.slice(3).split("\t")[0];

    if (x === "?" && y === "?") {
      untracked.push({ path, status: "?" });
      continue;
    }

    if (x && x !== " " && x !== "?") {
      staged.push({ path, status: toStatus(x) });
    }
    if (y && y !== " " && y !== "?") {
      unstaged.push({ path, status: toStatus(y) });
    }
  }

  return { staged, unstaged, untracked };
}

function toStatus(char: string): GitFileStatus {
  const known: Record<string, GitFileStatus> = { A: "A", D: "D", R: "R" };
  return known[char] ?? "M";
}
