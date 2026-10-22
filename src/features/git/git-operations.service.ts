import { Injectable, signal } from "@angular/core";
import { CommandRunnerResultContract } from "@cogno/core/api/command-runner-port";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { GitRepositoryService } from "./git-repository.service";
import { GitBranch, GitOperation, GitRemoteBranch } from "./model/git-model";
import { isPushRejected } from "./model/git-parsers";

export type GitPullMode = "fetch" | "merge" | "ff-only" | "rebase";
export type GitResetMode = "soft" | "mixed" | "hard";

/**
 * What an operation ended in. `rejected` is a refusal the user may override by
 * forcing: a push that is not a fast-forward. It is not toasted; the caller
 * asks instead.
 */
export type GitOperationOutcome = "ok" | "failed" | "rejected";

const LOCAL_TIMEOUT_MS = 30_000;
const NETWORK_TIMEOUT_MS = 120_000;
const CLONE_TIMEOUT_MS = 600_000;
const CREDENTIAL_CACHE_SECONDS = 3600;

/**
 * Git never gets a terminal here, so nothing may wait for an editor: `--continue`
 * keeps the prepared message (`core.editor=true` accepts it unchanged).
 */
const NO_EDITOR = ["-c", "core.editor=true"];

type RunOptions = {
  readonly timeoutMs?: number;
  readonly stdin?: string;
  /** Toast shown on success; failures always show git's own message. */
  readonly success?: string;
  /** Stdout is a machine format, not a line for the success toast. */
  readonly machineOutput?: boolean;
  readonly inCwd?: boolean;
  /**
   * Recognises a refusal the user may override (see `GitOperationOutcome`) from
   * a machine-readable output, never from git's messages; it is returned, not toasted.
   */
  readonly refused?: (result: CommandRunnerResultContract) => boolean;
};

/**
 * Every git command that changes the repository, run in the bound session.
 * Each one reports a failure with git's own message and re-reads the
 * repository afterwards, whatever the outcome - a failed merge still leaves
 * conflicts behind.
 */
@Injectable({ providedIn: "root" })
export class GitOperationsService {
  private readonly busySignal = signal<string | null>(null);
  /** Label of the long-running operation in progress, for the toolbar. */
  readonly busy = this.busySignal.asReadonly();

  constructor(
    private readonly repository: GitRepositoryService,
    private readonly notifications: NotificationCenterPort,
  ) {}

  // Working tree

  stage(paths: ReadonlyArray<string>): Promise<GitOperationOutcome> {
    return this.git(["add", "-A", "--", ...paths], "Stage failed");
  }

  unstage(paths: ReadonlyArray<string>): Promise<GitOperationOutcome> {
    // `reset` also works before the first commit, where `restore --staged` has no HEAD.
    return this.git(["reset", "-q", "--", ...paths], "Unstage failed");
  }

  stageAll(): Promise<GitOperationOutcome> {
    return this.git(["add", "-A"], "Stage all failed");
  }

  unstageAll(): Promise<GitOperationOutcome> {
    return this.git(["reset", "-q"], "Unstage all failed");
  }

  /** Throws away the unstaged changes of tracked files and deletes untracked ones. */
  async discard(
    tracked: ReadonlyArray<string>,
    untracked: ReadonlyArray<string>,
  ): Promise<GitOperationOutcome> {
    if (tracked.length > 0) {
      const outcome = await this.git(["restore", "--worktree", "--", ...tracked], "Discard failed");
      if (outcome !== "ok") return outcome;
    }
    if (untracked.length > 0) {
      return this.git(["clean", "-f", "-d", "--", ...untracked], "Discard failed");
    }
    return "ok";
  }

  /**
   * Apply a patch built from a hunk or chosen lines (git-patch.ts). `cached`
   * changes the index (stage, or with `reverse` unstage); without it the
   * working tree (discard, with `reverse`).
   */
  applyPatch(
    patch: string,
    options: { readonly cached: boolean; readonly reverse: boolean },
  ): Promise<GitOperationOutcome> {
    return this.git(
      [
        "apply",
        ...(options.cached ? ["--cached"] : []),
        ...(options.reverse ? ["--reverse"] : []),
        "--whitespace=nowarn",
        "--recount",
        "-",
      ],
      options.cached ? (options.reverse ? "Unstage failed" : "Stage failed") : "Discard failed",
      { stdin: patch },
    );
  }

  takeConflictSide(path: string, side: "ours" | "theirs"): Promise<GitOperationOutcome> {
    return this.sequence(
      [
        ["checkout", `--${side}`, "--", path],
        ["add", "--", path],
      ],
      "Resolve failed",
    );
  }

  markResolved(path: string): Promise<GitOperationOutcome> {
    return this.git(["add", "--", path], "Mark resolved failed");
  }

  commit(summary: string, description: string): Promise<GitOperationOutcome> {
    const message = description.trim()
      ? `${summary.trim()}\n\n${description.trim()}`
      : summary.trim();
    return this.git(["commit", "-m", message], "Commit failed", { success: "Committed" });
  }

  /** Put a file back the way it is in `ref`, in the working tree and the index. */
  restoreFile(ref: string, path: string): Promise<GitOperationOutcome> {
    return this.git(["checkout", ref, "--", path], "Restore failed");
  }

  // Branches and commits

  checkoutBranch(name: string): Promise<GitOperationOutcome> {
    return this.git(["switch", name], "Checkout failed");
  }

  /** A local branch tracking the remote branch, or the existing one of that name. */
  checkoutRemoteBranch(remoteBranch: GitRemoteBranch): Promise<GitOperationOutcome> {
    const local = this.repository.refs().branches.some((b) => b.name === remoteBranch.shortName);
    return local
      ? this.git(["switch", remoteBranch.shortName], "Checkout failed")
      : this.git(["switch", "--track", remoteBranch.name], "Checkout failed");
  }

  checkoutCommit(ref: string): Promise<GitOperationOutcome> {
    return this.git(["switch", "--detach", ref], "Checkout failed");
  }

  createBranch(name: string, startPoint: string, checkout: boolean): Promise<GitOperationOutcome> {
    return checkout
      ? this.git(["switch", "-c", name, startPoint], "Create branch failed")
      : this.git(["branch", name, startPoint], "Create branch failed");
  }

  renameBranch(name: string, newName: string): Promise<GitOperationOutcome> {
    return this.git(["branch", "-m", name, newName], "Rename failed");
  }

  /**
   * The branches whose tip is neither in HEAD nor in their upstream: deleting
   * them may lose commits. An upstream in `goingUpstreams` is deleted along
   * with them and does not count. Asked before deleting, from a ref list and
   * exit codes; a branch git cannot answer for counts as unmerged.
   */
  async unmergedBranches(
    branches: ReadonlyArray<GitBranch>,
    goingUpstreams: ReadonlyArray<string> = [],
  ): Promise<ReadonlyArray<string>> {
    const merged = await this.repository.run(
      ["for-each-ref", "--merged=HEAD", "--format=%(refname)", "refs/heads"],
      LOCAL_TIMEOUT_MS,
    );
    const inHead = new Set(merged?.exitCode === 0 ? merged.stdout.split("\n") : []);
    const kept = await Promise.all(
      branches.map(async (branch) => {
        if (inHead.has(`refs/heads/${branch.name}`)) return true;
        const upstream = branch.upstream;
        if (!upstream || branch.upstreamGone || goingUpstreams.includes(upstream)) return false;
        const inUpstream = await this.repository.run(
          ["merge-base", "--is-ancestor", `refs/heads/${branch.name}`, upstream],
          LOCAL_TIMEOUT_MS,
        );
        return inUpstream?.exitCode === 0;
      }),
    );
    return branches.filter((_, index) => !kept[index]).map((branch) => branch.name);
  }

  /**
   * Deletes local branches in one run, merged or not, and returns the ones
   * still there, read back from the refs rather than from git's messages.
   */
  async deleteBranches(names: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
    const result = await this.repository.run(["branch", "-D", ...names], LOCAL_TIMEOUT_MS);
    this.report(result, names.length === 1 ? "Delete branch failed" : "Delete branches failed");
    const listed = await this.repository.run(
      ["for-each-ref", "--format=%(refname)", ...names.map((name) => `refs/heads/${name}`)],
      LOCAL_TIMEOUT_MS,
    );
    await this.repository.refresh();
    // Without an answer nothing counts as deleted, so no remote branch goes with it.
    if (listed?.exitCode !== 0) return names;
    const existing = new Set(listed.stdout.split("\n"));
    return names.filter((name) => existing.has(`refs/heads/${name}`));
  }

  merge(ref: string): Promise<GitOperationOutcome> {
    return this.git(["merge", "--no-edit", ref], "Merge stopped", { success: `Merged ${ref}` });
  }

  rebase(onto: string): Promise<GitOperationOutcome> {
    return this.git([...NO_EDITOR, "rebase", onto], "Rebase stopped", {
      success: `Rebased onto ${onto}`,
    });
  }

  cherryPick(sha: string, isMerge: boolean): Promise<GitOperationOutcome> {
    return this.git(["cherry-pick", ...(isMerge ? ["-m", "1"] : []), sha], "Cherry pick stopped", {
      success: "Cherry picked",
    });
  }

  revert(sha: string, isMerge: boolean): Promise<GitOperationOutcome> {
    return this.git(
      ["revert", "--no-edit", ...(isMerge ? ["-m", "1"] : []), sha],
      "Revert stopped",
      {
        success: "Reverted",
      },
    );
  }

  reset(ref: string, mode: GitResetMode): Promise<GitOperationOutcome> {
    return this.git(["reset", `--${mode}`, ref], "Reset failed");
  }

  continueOperation(operation: GitOperation): Promise<GitOperationOutcome> {
    return this.git([...NO_EDITOR, operation, "--continue"], `Continue ${operation} failed`);
  }

  abortOperation(operation: GitOperation): Promise<GitOperationOutcome> {
    return this.git([operation, "--abort"], `Abort ${operation} failed`);
  }

  skipCommit(operation: GitOperation): Promise<GitOperationOutcome> {
    return this.git([...NO_EDITOR, operation, "--skip"], `Skip failed`);
  }

  // Tags

  createTag(name: string, ref: string, message: string): Promise<GitOperationOutcome> {
    return message.trim()
      ? this.git(["tag", "-a", name, "-m", message.trim(), ref], "Create tag failed")
      : this.git(["tag", name, ref], "Create tag failed");
  }

  deleteTag(name: string): Promise<GitOperationOutcome> {
    return this.git(["tag", "-d", name], "Delete tag failed");
  }

  pushTag(remote: string, name: string): Promise<GitOperationOutcome> {
    return this.network(["push", remote, `refs/tags/${name}`], `Pushing ${name}`, `Pushed ${name}`);
  }

  deleteRemoteTag(remote: string, name: string): Promise<GitOperationOutcome> {
    return this.network(
      ["push", remote, "--delete", `refs/tags/${name}`],
      `Deleting ${name}`,
      `Deleted ${name} from ${remote}`,
    );
  }

  // Stashes

  stash(message: string): Promise<GitOperationOutcome> {
    return this.git(
      ["stash", "push", "--include-untracked", ...(message.trim() ? ["-m", message.trim()] : [])],
      "Stash failed",
    );
  }

  applyStash(ref: string): Promise<GitOperationOutcome> {
    return this.git(["stash", "apply", ref], "Apply stash failed");
  }

  popStash(ref: string): Promise<GitOperationOutcome> {
    return this.git(["stash", "pop", ref], "Pop stash failed");
  }

  dropStash(ref: string): Promise<GitOperationOutcome> {
    return this.git(["stash", "drop", ref], "Delete stash failed");
  }

  // Remotes

  fetch(remote: string | null): Promise<GitOperationOutcome> {
    return this.network(
      ["fetch", "--prune", ...(remote ? [remote] : ["--all"])],
      "Fetching",
      remote ? `Fetched ${remote}` : "Fetched all remotes",
    );
  }

  pull(mode: GitPullMode): Promise<GitOperationOutcome> {
    if (mode === "fetch") return this.fetch(null);
    const flag = { merge: "--no-rebase", "ff-only": "--ff-only", rebase: "--rebase" }[mode];
    return this.network([...NO_EDITOR, "pull", flag], "Pulling", "Pulled");
  }

  /**
   * Pull a branch that is not checked out: fetch its upstream straight into
   * it. Git only moves it forward and refuses when the two have diverged.
   */
  pullBranch(branch: string, upstream: GitRemoteBranch): Promise<GitOperationOutcome> {
    return this.network(
      ["fetch", upstream.remote, `refs/heads/${upstream.shortName}:refs/heads/${branch}`],
      `Pulling ${branch}`,
      `Pulled ${branch}`,
    );
  }

  /**
   * Push `branch` to `remoteBranch` on `remote`. `setUpstream` makes the branch
   * track it from then on. `force` overwrites the remote branch only if it is
   * still where this repository last saw it (`--force-with-lease`).
   */
  push(
    branch: string,
    remote: string,
    remoteBranch: string,
    options: { readonly setUpstream: boolean; readonly force: boolean },
  ): Promise<GitOperationOutcome> {
    return this.network(
      [
        "push",
        "--porcelain",
        ...(options.force ? ["--force-with-lease"] : []),
        ...(options.setUpstream ? ["-u"] : []),
        remote,
        `refs/heads/${branch}:refs/heads/${remoteBranch}`,
      ],
      `Pushing ${branch}`,
      `Pushed ${branch}`,
      {
        machineOutput: true,
        ...(options.force ? {} : { refused: (result) => isPushRejected(result.stdout) }),
      },
    );
  }

  setUpstream(branch: string, upstream: string): Promise<GitOperationOutcome> {
    return this.git(["branch", `--set-upstream-to=${upstream}`, branch], "Set upstream failed");
  }

  deleteRemoteBranch(remoteBranch: GitRemoteBranch): Promise<GitOperationOutcome> {
    return this.network(
      ["push", remoteBranch.remote, "--delete", remoteBranch.shortName],
      `Deleting ${remoteBranch.name}`,
      `Deleted ${remoteBranch.name}`,
    );
  }

  /** Deletes several branches of one remote in a single push. */
  deleteRemoteBranches(
    remote: string,
    shortNames: ReadonlyArray<string>,
  ): Promise<GitOperationOutcome> {
    const count = shortNames.length === 1 ? shortNames[0] : `${shortNames.length} branches`;
    return this.network(
      ["push", remote, "--delete", ...shortNames],
      `Deleting ${count} on ${remote}`,
      `Deleted ${count} on ${remote}`,
    );
  }

  addRemote(name: string, url: string): Promise<GitOperationOutcome> {
    return this.git(["remote", "add", name, url], "Add remote failed");
  }

  removeRemote(name: string): Promise<GitOperationOutcome> {
    return this.git(["remote", "remove", name], "Remove remote failed");
  }

  // Repositories

  /** Clone into `directory`, relative to the bound terminal's cwd unless absolute. */
  clone(url: string, directory: string): Promise<GitOperationOutcome> {
    return this.withBusy(`Cloning ${url}`, () =>
      this.git(
        [
          ...this.credentialCacheArgs(),
          "clone",
          url,
          ...(directory.trim() ? [directory.trim()] : []),
        ],
        "Clone failed",
        {
          timeoutMs: CLONE_TIMEOUT_MS,
          success: "Cloned",
          inCwd: true,
        },
      ),
    );
  }

  /** Make the bound terminal's cwd a repository. */
  init(): Promise<GitOperationOutcome> {
    return this.git(["init"], "Init failed", { inCwd: true, success: "Repository initialized" });
  }

  private network(
    args: string[],
    busyLabel: string,
    success: string,
    options: Pick<RunOptions, "refused" | "machineOutput"> = {},
  ): Promise<GitOperationOutcome> {
    return this.withBusy(busyLabel, () =>
      this.git([...this.credentialCacheArgs(), ...args], `${busyLabel.split(" ")[0]} failed`, {
        ...options,
        timeoutMs: NETWORK_TIMEOUT_MS,
        success,
      }),
    );
  }

  /**
   * On macOS and Linux git's cache helper keeps credentials the user typed
   * into the prompt for an hour, so one push does not ask for every fetch.
   * It comes after the user's own helpers, and git forgets an entry the
   * remote rejects. Windows has the Git Credential Manager for this.
   */
  private credentialCacheArgs(): string[] {
    const session = this.repository.currentSession();
    if (!session || session.shellContext.backendOs === "windows") return [];
    return ["-c", `credential.helper=cache --timeout=${CREDENTIAL_CACHE_SECONDS}`];
  }

  private async withBusy(
    label: string,
    work: () => Promise<GitOperationOutcome>,
  ): Promise<GitOperationOutcome> {
    this.busySignal.set(label);
    try {
      return await work();
    } finally {
      this.busySignal.set(null);
    }
  }

  private async sequence(
    steps: ReadonlyArray<ReadonlyArray<string>>,
    errorHeader: string,
  ): Promise<GitOperationOutcome> {
    for (const args of steps) {
      const result = await this.repository.run(args, LOCAL_TIMEOUT_MS);
      if (!this.report(result, errorHeader)) {
        await this.repository.refresh();
        return "failed";
      }
    }
    await this.repository.refresh();
    return "ok";
  }

  private async git(
    args: ReadonlyArray<string>,
    errorHeader: string,
    options: RunOptions = {},
  ): Promise<GitOperationOutcome> {
    const timeoutMs = options.timeoutMs ?? LOCAL_TIMEOUT_MS;
    const result = options.inCwd
      ? await this.repository.runInCwd(args, timeoutMs, options.stdin)
      : await this.repository.run(args, timeoutMs, options.stdin);
    if (options.refused && result && result.exitCode !== 0 && options.refused(result)) {
      await this.repository.refresh();
      return "rejected";
    }
    const ok = this.report(result, errorHeader, options.success, options.machineOutput);
    await this.repository.refresh();
    return ok ? "ok" : "failed";
  }

  /** Toast the outcome; false when git failed or did not run. */
  private report(
    result: CommandRunnerResultContract | null,
    errorHeader: string,
    success?: string,
    machineOutput = false,
  ): boolean {
    if (!result) {
      this.toast(errorHeader, "Git could not run in this terminal.", "error");
      return false;
    }
    if (result.exitCode !== 0) {
      const body =
        result.exitCode === 124
          ? "Git did not finish in time. If it waits for credentials, run the command in the terminal once."
          : result.stderr.trim() || result.stdout.trim();
      this.toast(errorHeader, body, "error");
      return false;
    }
    if (success) {
      this.toast(success, machineOutput ? "" : (firstLine(result.stdout) ?? ""), "success");
    }
    return true;
  }

  private toast(header: string, body: string, type: "error" | "success"): void {
    this.notifications.dispatch({ header, body, type, source: "git", channels: { toast: true } });
  }
}

function firstLine(text: string): string | undefined {
  return text
    .split("\n")
    .find((line) => line.trim())
    ?.trim();
}
