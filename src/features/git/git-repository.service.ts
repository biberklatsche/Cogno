import { computed, DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommandRunnerResultContract } from "@cogno/core/api/command-runner-port";
import { BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { filter } from "rxjs";
import { layoutGraph } from "./model/git-graph";
import {
  GitCommit,
  GitCommitDetail,
  GitHead,
  GitOperation,
  GitRefs,
  GitRemote,
  GitStash,
  GitStatus,
} from "./model/git-model";
import {
  buildRefLabels,
  COMMIT_DETAIL_FORMAT,
  LOG_FORMAT,
  parseCommitDetail,
  parseGitStatus,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseRemotes,
  parseStashes,
  REF_FORMAT,
  STASH_FORMAT,
} from "./model/git-parsers";

export type GitError = "not_installed" | "no_repo" | "status_failed" | "unavailable";

/** The commit count the graph loads first and adds per "load more". */
export const GIT_LOG_PAGE_SIZE = 1000;
const READ_TIMEOUT_MS = 10_000;

const EMPTY_STATUS: GitStatus = { staged: [], unstaged: [], untracked: [], conflicted: [] };
const EMPTY_REFS: GitRefs = { branches: [], remoteBranches: [], tags: [] };

/** Files in the git dir that say which operation git stopped in. */
const OPERATION_MARKERS: ReadonlyArray<readonly [string, GitOperation]> = [
  ["rebase-merge/head-name", "rebase"],
  ["rebase-apply/head-name", "rebase"],
  ["MERGE_HEAD", "merge"],
  ["CHERRY_PICK_HEAD", "cherry-pick"],
  ["REVERT_HEAD", "revert"],
];

/**
 * The repository of the terminal the panel is bound to (the focused one,
 * ARCHITECTURE.md 3): its root, HEAD, working tree, refs, stashes and commit
 * graph. Everything is read with git in the bound session, so it is correct in
 * the session's own shell context, and re-read when the binding moves, the
 * session's cwd changes or a command in it finishes.
 */
@Injectable({ providedIn: "root" })
export class GitRepositoryService {
  private readonly rootSignal = signal<string | null>(null);
  private readonly headSignal = signal<GitHead>({ sha: null, branch: null });
  private readonly statusSignal = signal<GitStatus>(EMPTY_STATUS);
  private readonly refsSignal = signal<GitRefs>(EMPTY_REFS);
  private readonly remotesSignal = signal<ReadonlyArray<GitRemote>>([]);
  private readonly stashesSignal = signal<ReadonlyArray<GitStash>>([]);
  private readonly commitsSignal = signal<ReadonlyArray<GitCommit>>([]);
  private readonly operationSignal = signal<GitOperation | null>(null);
  private readonly errorSignal = signal<GitError | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly logLimitSignal = signal(GIT_LOG_PAGE_SIZE);
  private readonly hasMoreCommitsSignal = signal(false);

  readonly root = this.rootSignal.asReadonly();
  readonly head = this.headSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly refs = this.refsSignal.asReadonly();
  readonly remotes = this.remotesSignal.asReadonly();
  readonly stashes = this.stashesSignal.asReadonly();
  readonly commits = this.commitsSignal.asReadonly();
  readonly operation = this.operationSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly hasMoreCommits = this.hasMoreCommitsSignal.asReadonly();

  readonly refLabels = computed(() => buildRefLabels(this.refsSignal(), this.headSignal()));
  readonly graph = computed(() => layoutGraph(this.commitsSignal()));
  readonly changeCount = computed(() => {
    const status = this.statusSignal();
    return (
      status.staged.length +
      status.unstaged.length +
      status.untracked.length +
      status.conflicted.length
    );
  });
  /** The checked-out branch with its upstream, when HEAD is on a branch. */
  readonly currentBranch = computed(() => {
    const branch = this.headSignal().branch;
    return branch ? (this.refsSignal().branches.find((b) => b.name === branch) ?? null) : null;
  });

  private boundSession: BoundSessionHandle | null = null;
  private gitDir: string | null = null;
  private active = false;
  private refreshInFlight = false;
  private refreshPending = false;
  private contextPending = false;

  constructor(
    sessionApi: SessionApi,
    terminalMonitor: TerminalMonitorPort,
    destroyRef: DestroyRef,
  ) {
    sessionApi.boundSession$.pipe(takeUntilDestroyed(destroyRef)).subscribe((boundSession) => {
      this.boundSession = boundSession.status === "active" ? boundSession.session : null;
      if (this.active) this.requestRefresh(true);
    });
    sessionApi.cwdChanges$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      if (this.active) this.requestRefresh(true);
    });
    // A command that finished in the bound terminal (a `git commit` typed there) may have
    // changed the repository.
    terminalMonitor.activity$
      .pipe(
        filter(
          (event) => !event.isBusy && event.terminalId === this.boundSession?.identity.terminalId,
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        if (this.active) this.requestRefresh(false);
      });
    destroyRef.onDestroy(() => this.stop());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.requestRefresh(true);
  }

  stop(): void {
    this.active = false;
  }

  refresh(): Promise<void> {
    return this.requestRefresh(false);
  }

  loadMoreCommits(): Promise<void> {
    this.logLimitSignal.update((limit) => limit + GIT_LOG_PAGE_SIZE);
    return this.refresh();
  }

  /** The session git runs in right now; null without a bound session. */
  currentSession(): BoundSessionHandle | null {
    return this.boundSession;
  }

  /**
   * Run git in the repository root of the bound session. Null when there is no
   * repository or the session refused (focus moved, remote context).
   */
  async run(
    args: ReadonlyArray<string>,
    timeoutMs = READ_TIMEOUT_MS,
    stdin?: string,
  ): Promise<CommandRunnerResultContract | null> {
    const root = this.rootSignal();
    const session = this.boundSession;
    if (!session || !root) return null;
    return runGit(session, ["-C", root, ...args], timeoutMs, stdin);
  }

  /** Run git in the bound session's cwd, without a repository (clone, init). */
  async runInCwd(
    args: ReadonlyArray<string>,
    timeoutMs: number,
    stdin?: string,
  ): Promise<CommandRunnerResultContract | null> {
    const session = this.boundSession;
    if (!session) return null;
    return runGit(session, args, timeoutMs, stdin);
  }

  async loadCommitDetail(sha: string): Promise<GitCommitDetail | null> {
    const show = await this.run(["show", "-s", `--format=${COMMIT_DETAIL_FORMAT}`, sha]);
    if (!show || show.exitCode !== 0) return null;
    const firstParent = show.stdout.split("\x1f")[1]?.split(" ")[0] ?? "";
    // Diff against the first parent, so a merge shows what it brought into the branch.
    const diffArgs = firstParent
      ? ["diff-tree", "-r", "-z", "--name-status", "-M", firstParent, sha]
      : ["diff-tree", "-r", "-z", "--name-status", "--root", "--no-commit-id", sha];
    const files = await this.run(diffArgs);
    return parseCommitDetail(
      show.stdout,
      files?.exitCode === 0 ? parseNameStatus(files.stdout) : [],
    );
  }

  /**
   * Coalesces requests: one that comes in while a refresh runs - a focus
   * switch, a cd, a finished command - is not dropped but runs once the
   * current one is done. `resolveContext` re-derives the repository root.
   */
  private async requestRefresh(resolveContext: boolean): Promise<void> {
    if (resolveContext) this.contextPending = true;
    if (this.refreshInFlight) {
      this.refreshPending = true;
      return;
    }
    this.refreshInFlight = true;
    try {
      do {
        this.refreshPending = false;
        const withContext = this.contextPending;
        this.contextPending = false;
        await this.load(withContext);
      } while (this.refreshPending);
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async load(resolveContext: boolean): Promise<void> {
    const session = this.boundSession;
    if (!session) {
      this.clear(null);
      return;
    }
    this.loadingSignal.set(true);
    try {
      if (resolveContext || !this.rootSignal()) {
        const resolved = await this.resolveRoot(session);
        if (!resolved || session !== this.boundSession) return;
      }
      await this.loadRepository(session);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async resolveRoot(session: BoundSessionHandle): Promise<boolean> {
    // Runs in the session's cwd to find the repository it is in.
    const outcome = await session.run({
      executable: "git",
      args: ["rev-parse", "--show-toplevel", "--absolute-git-dir"],
      contextRevision: session.contextRevision,
      timeoutMs: READ_TIMEOUT_MS,
    });
    // Another terminal took focus meanwhile; the pending refresh resolves its repository.
    if (session !== this.boundSession) return false;
    if (outcome.status === "rejected") {
      // A remote/unknown session has no local git; a stale binding just retries.
      this.clear(outcome.reason === "unknown-context" ? "unavailable" : null);
      return false;
    }
    const { exitCode, stdout } = outcome.result;
    const [root, gitDir] = stdout.split("\n").map((line) => line.trim());
    if (exitCode !== 0 || !root || !gitDir) {
      // exit 128 = "not a git repository"; anything else means git isn't usable.
      this.clear(exitCode === 128 || exitCode === 0 ? "no_repo" : "not_installed");
      return false;
    }
    if (root !== this.rootSignal()) {
      this.logLimitSignal.set(GIT_LOG_PAGE_SIZE);
      this.commitsSignal.set([]);
    }
    this.rootSignal.set(root);
    this.gitDir = gitDir;
    return true;
  }

  private async loadRepository(session: BoundSessionHandle): Promise<void> {
    const root = this.rootSignal();
    if (!root) return;
    const git = (args: ReadonlyArray<string>) =>
      runGit(session, ["-C", root, ...args], READ_TIMEOUT_MS);

    const [status, sha, branch, refs, remotes, stashes, operation] = await Promise.all([
      git(["status", "--porcelain=v1", "-z", "-uall"]),
      git(["rev-parse", "-q", "--verify", "HEAD"]),
      git(["symbolic-ref", "-q", "--short", "HEAD"]),
      git(["for-each-ref", `--format=${REF_FORMAT}`, "refs/heads", "refs/remotes", "refs/tags"]),
      git(["remote", "-v"]),
      git(["stash", "list", `--format=${STASH_FORMAT}`]),
      this.readOperation(session),
    ]);
    // A rejection (focus moved, remote) keeps the last state; the refresh that the binding
    // change triggered reads the new one.
    if (session !== this.boundSession || !status || !sha || !branch || !refs) return;
    if (status.exitCode !== 0) {
      this.errorSignal.set("status_failed");
      return;
    }

    const head: GitHead = {
      sha: sha.exitCode === 0 ? sha.stdout.trim() || null : null,
      branch: branch.exitCode === 0 ? branch.stdout.trim() || null : null,
    };
    const parsedRefs = refs.exitCode === 0 ? parseRefs(refs.stdout) : EMPTY_REFS;
    const commits = await this.loadLog(git, head, parsedRefs);
    if (session !== this.boundSession) return;

    this.errorSignal.set(null);
    this.statusSignal.set(parseGitStatus(status.stdout));
    this.headSignal.set(head);
    this.refsSignal.set(parsedRefs);
    this.remotesSignal.set(remotes?.exitCode === 0 ? parseRemotes(remotes.stdout) : []);
    this.stashesSignal.set(stashes?.exitCode === 0 ? parseStashes(stashes.stdout) : []);
    this.operationSignal.set(operation);
    if (commits) {
      this.commitsSignal.set(commits);
      this.hasMoreCommitsSignal.set(commits.length >= this.logLimitSignal());
    }
  }

  private async loadLog(
    git: (args: ReadonlyArray<string>) => Promise<CommandRunnerResultContract | null>,
    head: GitHead,
    refs: GitRefs,
  ): Promise<GitCommit[] | null> {
    const hasRefs = refs.branches.length + refs.remoteBranches.length + refs.tags.length > 0;
    // Before the first commit there is nothing to log; `git log` would fail on HEAD.
    if (!head.sha && !hasRefs) return [];
    const result = await git([
      "log",
      "--branches",
      "--remotes",
      "--tags",
      ...(head.sha ? ["HEAD"] : []),
      "--date-order",
      `-n${this.logLimitSignal()}`,
      `--format=${LOG_FORMAT}`,
    ]);
    if (!result) return null;
    return result.exitCode === 0 ? parseLog(result.stdout) : [];
  }

  private async readOperation(session: BoundSessionHandle): Promise<GitOperation | null> {
    const gitDir = this.gitDir;
    if (!gitDir) return null;
    for (const [marker, operation] of OPERATION_MARKERS) {
      const path = session.fs.normalizePath(`${gitDir}/${marker}`);
      const exists = await session.fs.readTextFile(path).then(
        () => true,
        () => false,
      );
      if (exists) return operation;
    }
    return null;
  }

  private clear(error: GitError | null): void {
    this.rootSignal.set(null);
    this.gitDir = null;
    this.headSignal.set({ sha: null, branch: null });
    this.statusSignal.set(EMPTY_STATUS);
    this.refsSignal.set(EMPTY_REFS);
    this.remotesSignal.set([]);
    this.stashesSignal.set([]);
    this.commitsSignal.set([]);
    this.operationSignal.set(null);
    this.hasMoreCommitsSignal.set(false);
    this.logLimitSignal.set(GIT_LOG_PAGE_SIZE);
    this.errorSignal.set(error);
  }
}

/** Run `git` in a session; null when the session rejects it. */
async function runGit(
  session: BoundSessionHandle,
  args: ReadonlyArray<string>,
  timeoutMs: number,
  stdin?: string,
): Promise<CommandRunnerResultContract | null> {
  const outcome = await session.run({
    executable: "git",
    args: [...args],
    contextRevision: session.contextRevision,
    timeoutMs,
    ...(stdin === undefined ? {} : { stdin }),
  });
  return outcome.status === "ran" ? outcome.result : null;
}
