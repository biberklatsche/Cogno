import { computed, DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import { CommandRunnerResultContract, NotificationCenterPort } from "@cogno/shared/ports";

export type GitFileStatus = "M" | "A" | "D" | "R" | "?";

export type GitFile = {
  readonly path: string;
  readonly status: GitFileStatus;
  readonly isDirectory: boolean;
};

export type GitStatus = {
  readonly gitRoot: string;
  readonly branch: string;
  readonly staged: ReadonlyArray<GitFile>;
  readonly unstaged: ReadonlyArray<GitFile>;
  readonly untracked: ReadonlyArray<GitFile>;
};

export type GitError = "not_installed" | "no_repo" | "status_failed" | "no_commits" | "unavailable";

const GIT_TIMEOUT_MS = 5_000;

@Injectable({ providedIn: "root" })
export class GitStatusService {
  private readonly gitStatusSignal = signal<GitStatus | null>(null);
  private readonly gitErrorSignal = signal<GitError | null>(null);
  private readonly loadingSignal = signal(false);

  readonly status = this.gitStatusSignal.asReadonly();
  readonly gitError = this.gitErrorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly stagedCount = computed(() => this.gitStatusSignal()?.staged.length ?? 0);

  private boundSession: BoundSessionHandle | null = null;
  private currentGitRoot: string | null = null;
  private active = false;
  private refreshContextInFlight = false;
  private refreshStatusInFlight = false;
  private refreshStatusPending = false;

  constructor(
    sessionApi: SessionApi,
    private readonly notificationCenterPort: NotificationCenterPort,
    destroyRef: DestroyRef,
  ) {
    sessionApi.boundSession$.pipe(takeUntilDestroyed(destroyRef)).subscribe((boundSession) => {
      this.boundSession = boundSession.status === "active" ? boundSession.session : null;
      if (this.active) void this.refreshContext();
    });
    sessionApi.cwdChanges$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (this.active) void this.refreshContext();
    });

    destroyRef.onDestroy(() => this.stop());
  }

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
    const session = this.boundSession;
    if (!session || !this.currentGitRoot) return [];
    const result = await this.runGit(
      session,
      ["status", "--porcelain=v1", "-uall", "--", dirPath],
      GIT_TIMEOUT_MS,
    );
    if (!result || result.exitCode !== 0) return [];
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
      const session = this.boundSession;
      if (!session) {
        this.clear();
        return;
      }
      // `rev-parse --show-toplevel` runs in the session's own cwd to find the root.
      const outcome = await session.run({
        executable: "git",
        args: ["rev-parse", "--show-toplevel"],
        contextRevision: session.contextRevision,
        timeoutMs: GIT_TIMEOUT_MS,
      });
      if (outcome.status === "rejected") {
        this.currentGitRoot = null;
        this.gitStatusSignal.set(null);
        // A remote/unknown session has no local git; a stale binding just retries.
        this.gitErrorSignal.set(outcome.reason === "unknown-context" ? "unavailable" : null);
        return;
      }

      const result = outcome.result;
      if (result.exitCode !== 0) {
        this.currentGitRoot = null;
        this.gitStatusSignal.set(null);
        // exit 128 = "not a git repository"; anything else means git isn't usable.
        this.gitErrorSignal.set(result.exitCode === 128 ? "no_repo" : "not_installed");
        return;
      }

      const root = result.stdout.trim();
      if (!root) {
        this.currentGitRoot = null;
        this.gitStatusSignal.set(null);
        this.gitErrorSignal.set("no_repo");
        return;
      }

      this.currentGitRoot = root;
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
    const session = this.boundSession;
    const gitRoot = this.currentGitRoot;
    if (!session || !gitRoot) return;
    this.loadingSignal.set(true);
    try {
      const [statusResult, branchResult] = await Promise.all([
        this.runGit(session, ["-C", gitRoot, "status", "--porcelain=v1"], GIT_TIMEOUT_MS),
        this.runGit(session, ["-C", gitRoot, "rev-parse", "--abbrev-ref", "HEAD"], GIT_TIMEOUT_MS),
      ]);

      // A rejection (focus moved, remote) leaves the last status; the next
      // refresh triggered by the binding change resolves it.
      if (!statusResult || !branchResult) return;

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
      this.gitStatusSignal.set({
        gitRoot,
        branch: branchResult.stdout.trim() || "HEAD",
        ...parseGitStatus(statusResult.stdout),
      });
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private clear(): void {
    this.currentGitRoot = null;
    this.gitStatusSignal.set(null);
    this.gitErrorSignal.set(null);
  }

  /** Run `git` in the bound session; returns null when the session rejects it. */
  private async runGit(
    session: BoundSessionHandle,
    args: ReadonlyArray<string>,
    timeoutMs: number,
  ): Promise<CommandRunnerResultContract | null> {
    const outcome = await session.run({
      executable: "git",
      args: [...args],
      contextRevision: session.contextRevision,
      timeoutMs,
    });
    return outcome.status === "ran" ? outcome.result : null;
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
    const session = this.boundSession;
    const gitRoot = this.currentGitRoot;
    if (!session || !gitRoot) return;
    const { timeoutMs = 10_000, successHeader, successBody } = options;
    const result = await this.runGit(session, ["-C", gitRoot, ...args], timeoutMs);
    if (!result) return;
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
