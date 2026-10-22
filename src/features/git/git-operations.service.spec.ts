import type { CommandRunnerResultContract } from "@cogno/core/api/command-runner-port";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitOperationsService } from "./git-operations.service";
import type { GitRepositoryService } from "./git-repository.service";

describe("GitOperationsService", () => {
  let answer: CommandRunnerResultContract | null;
  let run: ReturnType<typeof vi.fn>;
  let runInCwd: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof vi.fn>;
  let backendOs: "linux" | "windows";
  let service: GitOperationsService;

  /** The cache helper every network command on macOS and Linux starts with. */
  const CACHE = ["-c", "credential.helper=cache --timeout=3600"];

  beforeEach(() => {
    answer = { stdout: "", stderr: "", exitCode: 0 };
    run = vi.fn(() => Promise.resolve(answer));
    runInCwd = vi.fn(() => Promise.resolve(answer));
    refresh = vi.fn(() => Promise.resolve());
    dispatch = vi.fn();
    backendOs = "linux";
    const repository = {
      run,
      runInCwd,
      refresh,
      currentSession: () => ({ shellContext: { shellType: "Bash", backendOs } }),
      refs: () => ({
        branches: [{ name: "main" }],
        remoteBranches: [],
        tags: [],
      }),
    } as unknown as GitRepositoryService;
    service = new GitOperationsService(repository, {
      dispatch,
    } as unknown as NotificationCenterPort);
  });

  const argsOfLastRun = () => run.mock.calls.at(-1)?.[0];

  it("commits summary and description as one message and re-reads the repository", async () => {
    await service.commit("Fix bug ", " Details\nmore ");

    expect(argsOfLastRun()).toEqual(["commit", "-m", "Fix bug\n\nDetails\nmore"]);
    expect(refresh).toHaveBeenCalled();
  });

  it("pushes to an explicit remote branch and publishes with -u", async () => {
    await service.push("feature", "origin", "feature", { setUpstream: true, force: false });

    expect(argsOfLastRun()).toEqual([
      ...CACHE,
      "push",
      "-u",
      "origin",
      "refs/heads/feature:refs/heads/feature",
    ]);
  });

  it("returns a refused push as rejected without an error toast", async () => {
    answer = { stdout: "", stderr: " ! [rejected] main -> main (fetch first)", exitCode: 1 };

    const outcome = await service.push("main", "origin", "main", {
      setUpstream: false,
      force: false,
    });

    expect(outcome).toBe("rejected");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reports a refused force push as a failure", async () => {
    answer = { stdout: "", stderr: " ! [rejected] main -> main (stale info)", exitCode: 1 };

    const outcome = await service.push("main", "origin", "main", {
      setUpstream: false,
      force: true,
    });

    expect(argsOfLastRun()).toContain("--force-with-lease");
    expect(outcome).toBe("failed");
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("returns an unmerged branch delete as rejected so the user can force it", async () => {
    answer = { stdout: "", stderr: "error: The branch 'x' is not fully merged.", exitCode: 1 };

    expect(await service.deleteBranch("x", false)).toBe("rejected");
    expect(await service.deleteBranch("x", true)).toBe("failed");
    expect(argsOfLastRun()).toEqual(["branch", "-D", "x"]);
  });

  it("deletes several branches in one run and returns the ones still there", async () => {
    answer = {
      stdout: "Deleted branch a (was c1).",
      stderr: "error: the branch 'main' is not fully merged\nhint: run 'git branch -D main'",
      exitCode: 1,
    };

    expect(await service.deleteBranches(["a", "main"], false)).toEqual(["main"]);
    expect(argsOfLastRun()).toEqual(["branch", "-d", "a", "main"]);
    expect(refresh).toHaveBeenCalled();
    // An unmerged branch is a question for the caller, not an error.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reports other failures of a bulk branch delete", async () => {
    answer = { stdout: "", stderr: "error: branch 'nope' not found", exitCode: 1 };

    await service.deleteBranches(["nope"], true);

    expect(argsOfLastRun()).toEqual(["branch", "-D", "nope"]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", body: "error: branch 'nope' not found" }),
    );
  });

  it("pulls a branch that is not checked out by fetching its upstream into it", async () => {
    await service.pullBranch("dev", {
      name: "origin/feature/dev",
      remote: "origin",
      shortName: "feature/dev",
      sha: "c1",
      lastCommitAt: 0,
    });

    expect(argsOfLastRun()).toEqual([
      ...CACHE,
      "fetch",
      "origin",
      "refs/heads/feature/dev:refs/heads/dev",
    ]);
  });

  it("deletes several remote branches in one push", async () => {
    await service.deleteRemoteBranches("origin", ["a", "b"]);

    expect(argsOfLastRun()).toEqual([...CACHE, "push", "origin", "--delete", "a", "b"]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", header: "Deleted 2 branches on origin" }),
    );
  });

  it("checks out an existing local branch for a remote branch of the same name", async () => {
    await service.checkoutRemoteBranch({
      name: "origin/main",
      remote: "origin",
      shortName: "main",
      sha: "c1",
      lastCommitAt: 0,
    });
    expect(argsOfLastRun()).toEqual(["switch", "main"]);

    await service.checkoutRemoteBranch({
      name: "origin/dev",
      remote: "origin",
      shortName: "dev",
      sha: "c2",
      lastCommitAt: 0,
    });
    expect(argsOfLastRun()).toEqual(["switch", "--track", "origin/dev"]);
  });

  it("continues an operation without waiting for an editor", async () => {
    await service.continueOperation("rebase");

    expect(argsOfLastRun()).toEqual(["-c", "core.editor=true", "rebase", "--continue"]);
  });

  it("discards tracked changes with restore and deletes untracked files with clean", async () => {
    await service.discard(["a.ts"], ["new.ts"]);

    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ["restore", "--worktree", "--", "a.ts"],
      ["clean", "-f", "-d", "--", "new.ts"],
    ]);
  });

  it("clones in the terminal's cwd, not in a repository", async () => {
    await service.clone("https://x/y.git", "y");

    expect(runInCwd).toHaveBeenCalledWith(
      [...CACHE, "clone", "https://x/y.git", "y"],
      600_000,
      undefined,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("leaves credential caching to the Git Credential Manager on Windows", async () => {
    backendOs = "windows";

    await service.fetch("origin");

    expect(argsOfLastRun()).toEqual(["fetch", "--prune", "origin"]);
  });

  it("hands a patch to git apply on stdin", async () => {
    await service.applyPatch("diff --git a/x b/x\n", { cached: true, reverse: true });

    expect(run).toHaveBeenCalledWith(
      ["apply", "--cached", "--reverse", "--whitespace=nowarn", "--recount", "-"],
      30_000,
      "diff --git a/x b/x\n",
    );
  });

  it("explains a timeout instead of showing empty git output", async () => {
    answer = { stdout: "", stderr: "", exitCode: 124 };

    await service.fetch(null);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        body: expect.stringContaining("did not finish in time"),
      }),
    );
  });

  it("tells the user when git could not run in the terminal", async () => {
    answer = null;

    expect(await service.stageAll()).toBe("failed");
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
