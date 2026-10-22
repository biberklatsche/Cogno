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
  const ran = (stdout: string, exitCode = 0, stderr = ""): CommandRunnerResultContract => ({
    stdout,
    stderr,
    exitCode,
  });

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
      "--porcelain",
      "-u",
      "origin",
      "refs/heads/feature:refs/heads/feature",
    ]);
  });

  it("returns a push git refused as rejected without an error toast, read from --porcelain", async () => {
    answer = {
      stdout: "To origin\n!\trefs/heads/main:refs/heads/main\t[rejected] (fetch first)\nDone\n",
      // The message is translated; only the porcelain line counts.
      stderr: "Fehler: Fehler beim Versenden einiger Referenzen",
      exitCode: 1,
    };

    const outcome = await service.push("main", "origin", "main", {
      setUpstream: false,
      force: false,
    });

    expect(argsOfLastRun()).toContain("--porcelain");
    expect(outcome).toBe("rejected");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reports a push a hook refused as a failure, not as something to force", async () => {
    answer = {
      stdout: "!\trefs/heads/main:refs/heads/main\t[remote rejected] (pre-receive hook declined)\n",
      stderr: "",
      exitCode: 1,
    };

    const outcome = await service.push("main", "origin", "main", {
      setUpstream: false,
      force: false,
    });

    expect(outcome).toBe("failed");
  });

  it("reports a refused force push as a failure", async () => {
    answer = {
      stdout: "!\trefs/heads/main:refs/heads/main\t[rejected] (stale info)\n",
      stderr: "",
      exitCode: 1,
    };

    const outcome = await service.push("main", "origin", "main", {
      setUpstream: false,
      force: true,
    });

    expect(argsOfLastRun()).toContain("--force-with-lease");
    expect(outcome).toBe("failed");
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("finds unmerged branches from the merged ref list and the upstream's exit code", async () => {
    run.mockImplementation((args: string[]) => {
      if (args[0] === "for-each-ref") return Promise.resolve(ran("refs/heads/merged\n"));
      // `--is-ancestor` answers with its exit code: 0 in the upstream, 1 not.
      if (args[0] === "merge-base")
        return Promise.resolve(ran("", args[2] === "refs/heads/pushed" ? 0 : 1));
      return Promise.resolve(ran(""));
    });
    const branch = (name: string, upstream: string | null, upstreamGone = false) => ({
      name,
      sha: "c1",
      upstream,
      ahead: 0,
      behind: 0,
      upstreamGone,
      lastCommitAt: 0,
    });

    const unmerged = await service.unmergedBranches([
      branch("merged", null),
      branch("pushed", "origin/pushed"),
      branch("ahead", "origin/ahead"),
      branch("gone", "origin/gone", true),
      branch("local", null),
    ]);

    expect(unmerged).toEqual(["ahead", "gone", "local"]);
    expect(run).toHaveBeenCalledWith(
      ["merge-base", "--is-ancestor", "refs/heads/pushed", "origin/pushed"],
      expect.any(Number),
    );
  });

  it("deletes branches with -D and returns the ones still there, read back from the refs", async () => {
    run.mockImplementation((args: string[]) =>
      Promise.resolve(
        args[0] === "for-each-ref"
          ? // `refs/heads/b` also lists `b/x`; only exact names count.
            ran("refs/heads/b\nrefs/heads/b/x\n")
          : ran("", 1, "Fehler: Branch 'b' ist in einem anderen Worktree ausgecheckt"),
      ),
    );

    expect(await service.deleteBranches(["a", "b"])).toEqual(["b"]);
    expect(run).toHaveBeenCalledWith(["branch", "-D", "a", "b"], expect.any(Number));
    expect(run).toHaveBeenCalledWith(
      ["for-each-ref", "--format=%(refname)", "refs/heads/a", "refs/heads/b"],
      expect.any(Number),
    );
    // Git's message is shown as it is, not read.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        body: "Fehler: Branch 'b' ist in einem anderen Worktree ausgecheckt",
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("counts no branch as deleted when git cannot list them", async () => {
    run.mockImplementation((args: string[]) =>
      Promise.resolve(args[0] === "for-each-ref" ? ran("", 128) : ran("")),
    );

    expect(await service.deleteBranches(["a"])).toEqual(["a"]);
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
