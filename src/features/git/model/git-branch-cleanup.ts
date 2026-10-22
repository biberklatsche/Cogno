import { isDefaultBranch, shortName } from "./git-branch-sort";
import { GitBranch, GitHead, GitRefs, GitRemoteBranch } from "./git-model";

/**
 * What a branch's age is measured against: the newest commit on any branch,
 * so in an old repository nobody works on any more not every branch looks old.
 */
export function ageReference(refs: GitRefs): number {
  let newest = 0;
  for (const branch of [...refs.branches, ...refs.remoteBranches]) {
    newest = Math.max(newest, branch.lastCommitAt);
  }
  return newest;
}

/** Why a branch is never offered for a bulk delete, or null when it may go. */
export function keptReason(
  branch: GitBranch | GitRemoteBranch,
  refs: GitRefs,
  head: GitHead,
): string | null {
  if (!("remote" in branch) && shortName(branch) === head.branch) return "checked out";
  return isDefaultBranch(branch, refs) ? "default branch" : null;
}

/**
 * The remote branches the local branches track, for deleting them along with
 * the local ones. Only upstreams that still exist and may be deleted.
 */
export function trackedRemoteBranches(
  branches: ReadonlyArray<GitBranch>,
  refs: GitRefs,
  head: GitHead,
): GitRemoteBranch[] {
  return branches
    .map((branch) => refs.remoteBranches.find((r) => r.name === branch.upstream))
    .filter((r): r is GitRemoteBranch => !!r && !keptReason(r, refs, head));
}

/** Remote branches grouped by their remote, one push each. */
export function byRemote(remoteBranches: ReadonlyArray<GitRemoteBranch>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const branch of remoteBranches) {
    groups.set(branch.remote, [...(groups.get(branch.remote) ?? []), branch.shortName]);
  }
  return groups;
}
