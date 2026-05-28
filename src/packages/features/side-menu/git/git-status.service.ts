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
  readonly isDirectory: boolean;
};

export type GitStatus = {
  readonly gitRoot: string;
  readonly branch: string;
  readonly shellContext: ShellContextContract;
  readonly staged: ReadonlyArray<GitFile>;
  readonly unstaged: ReadonlyArray<GitFile>;
  readonly untracked: ReadonlyArray<GitFile>;
};

export type GitError = "not_installed" | "no_repo" | "status_failed" | "no_commits";

@Injectable({ providedIn: "root" })
export class GitStatusService {
  private readonly gitStatusSignal = signal<GitStatus | null>(null);
  private readonly gitErrorSignal = signal<GitError | null>(null);
  private readonly loadingSignal = signal(false);

  readonly status = this.gitStatusSignal.asReadonly();
  readonly gitError = this.gitErrorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly stagedCount = computed(() => this.gitStatusSignal()?.staged.length ?? 0);

  private currentGitRoot: string | null = null;
  private currentShellContext: ShellContextContract | null = null;
  private refreshContextInFlight = false;
  private refreshStatusInFlight = false;
  private refreshStatusPending = false;

  constructor(
    private readonly terminalGateway: TerminalGateway,
    private readonly commandRunner: CommandRunner,
    private readonly notificationCenterPort: NotificationCenterPort,
    destroyRef: DestroyRef,
  ) {
    merge(this.terminalGateway.focusedTerminalId$, this.terminalGateway.cwdChanges$)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (this.active) void this.refreshContext();
      });

    destroyRef.onDestroy(() => this.stop());
  }

  private active = false;

  start(): void {
    if (this.active) return;
    this.active = true;
    void this.refreshContext();
  }

  stop(): void {
    this.active = false;
  }

  async stageFile(filePath: string): Promise<void> {
    await this.runGitCommand(["add", "--", filePath], "Stage failed");
  }

  async listFilesInDir(dirPath: string): Promise<GitFile[]> {
    if (!this.currentGitRoot || !this.currentShellContext) return [];
    const result = await this.commandRunner.run({
      cwd: this.currentGitRoot,
      shellContext: this.currentShellContext,
      program: "git",
      args: ["status", "--porcelain=v1", "-uall", "--", dirPath],
      timeoutMs: 5_000,
    });
    if (result.exitCode !== 0) return [];
    const { unstaged, untracked } = parseGitStatus(result.stdout);
    return [...unstaged, ...untracked];
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
    await this.runGitCommand(["commit", "-m", message], "Commit failed", {
      timeoutMs: 15_000,
      successHeader: "Committed",
      successBody: (stdout) => stdout.split("\n")[0]?.trim() ?? "",
    });
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
        this.currentShellContext = null;
        return;
      }

      this.currentShellContext = snapshot.shellContext;
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
    if (this.refreshStatusInFlight) {
      this.refreshStatusPending = true;
      return;
    }
    this.refreshStatusInFlight = true;
    try {
      await this.doRefreshStatus();
    } finally {
      this.refreshStatusInFlight = false;
      if (this.refreshStatusPending) {
        this.refreshStatusPending = false;
        void this.refreshStatus();
      }
    }
  }

  private async doRefreshStatus(): Promise<void> {
    if (!this.currentGitRoot || !this.currentShellContext) return;
    this.loadingSignal.set(true);
    try {
      const [statusResult, branchResult] = await Promise.all([
        this.commandRunner.run({
          cwd: this.currentGitRoot,
          shellContext: this.currentShellContext,
          program: "git",
          args: ["status", "--porcelain=v1"],
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
        this.gitErrorSignal.set("status_failed");
        return;
      }

      if (branchResult.exitCode !== 0) {
        this.gitStatusSignal.set(null);
        this.gitErrorSignal.set("no_commits");
        return;
      }

      this.gitErrorSignal.set(null);
      const parsed = parseGitStatus(statusResult.stdout);
      this.gitStatusSignal.set({
        gitRoot: this.currentGitRoot,
        branch: branchResult.stdout.trim() || "HEAD",
        shellContext: this.currentShellContext,
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

    // exit 128 = git's "not a git repository"; anything else means git itself isn't usable
    const error: GitError = result.exitCode === 128 ? "no_repo" : "not_installed";
    return { gitRoot: null, error };
  }

  private async runGitCommand(
    args: string[],
    errorHeader: string,
    options: {
      timeoutMs?: number;
      successHeader?: string;
      successBody?: (stdout: string) => string;
    } = {},
  ): Promise<void> {
    if (!this.currentGitRoot || !this.currentShellContext) return;
    const { timeoutMs = 10_000, successHeader, successBody } = options;
    const result = await this.commandRunner.run({
      cwd: this.currentGitRoot,
      shellContext: this.currentShellContext,
      program: "git",
      args,
      timeoutMs,
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
    if (successHeader) {
      this.notificationCenterPort.dispatch({
        header: successHeader,
        body: successBody?.(result.stdout) ?? "",
        type: "success",
        source: "git",
        channels: { toast: true },
      });
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
      const isDirectory = path.endsWith("/");
      untracked.push({ path: isDirectory ? path.slice(0, -1) : path, status: "?", isDirectory });
      continue;
    }

    if (x && x !== " " && x !== "?") {
      staged.push({ path, status: toStatus(x), isDirectory: false });
    }
    if (y && y !== " " && y !== "?") {
      unstaged.push({ path, status: toStatus(y), isDirectory: false });
    }
  }

  return { staged, unstaged, untracked };
}

function toStatus(char: string): GitFileStatus {
  const known: Record<string, GitFileStatus> = { A: "A", D: "D", R: "R" };
  return known[char] ?? "M";
}
