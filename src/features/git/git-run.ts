import {
  CommandRunnerResultContract,
  ProcessPromptHandler,
} from "@cogno/core/api/command-runner-port";
import { SessionHandle } from "@cogno/core/api/session-api";

/**
 * Why there is no repository to show. `repo_unreadable`: there is one, but
 * git refuses it (an owner mismatch git calls dubious, a broken .git); the
 * detail says why, and offering `git init` there would be wrong.
 */
export type GitError =
  | "not_installed"
  | "no_repo"
  | "repo_unreadable"
  | "status_failed"
  | "unavailable";

/**
 * Idle time per read (`CommandRunnerRequestContract`). A status on a large
 * repository with a cold file cache is quiet for a long while before it
 * prints anything; ten seconds ended it on repositories that git itself
 * reads fine.
 */
export const READ_TIMEOUT_MS = 60_000;

/** What `runGit` needs of a session: the bound handle and a directory handle both have it. */
export type GitSession = Pick<SessionHandle, "contextRevision" | "run">;

/** Run `git` in a session; null when the session rejects it. */
export async function runGit(
  session: GitSession,
  args: ReadonlyArray<string>,
  timeoutMs: number,
  stdin?: string,
  onPrompt?: ProcessPromptHandler,
): Promise<CommandRunnerResultContract | null> {
  const outcome = await session.run({
    executable: "git",
    args: [...args],
    contextRevision: session.contextRevision,
    timeoutMs,
    ...(stdin === undefined ? {} : { stdin }),
    ...(onPrompt === undefined ? {} : { onPrompt }),
  });
  return outcome.status === "ran" ? outcome.result : null;
}

/**
 * Exit 128 alone does not mean "not a repository": git uses it for every
 * fatal error, and only the message tells a missing repository from one git
 * will not touch (dubious ownership, a corrupt .git). Any other failure means
 * git itself did not run, or is too old for the options used here.
 */
export function classifyRootFailure(exitCode: number, stderr: string): GitError {
  if (exitCode === 0) return "no_repo";
  if (exitCode !== 128) return "not_installed";
  return /not a git repository/i.test(stderr) ? "no_repo" : "repo_unreadable";
}
