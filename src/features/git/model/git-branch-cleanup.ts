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
 * The remote branches to delete along with the local branches `names`: the
 * existing upstreams that may be deleted and that no other local branch still
 * tracks. Each one once, however many of the branches track it.
 */
export function remoteBranchesToDelete(
  names: ReadonlyArray<string>,
  refs: GitRefs,
  head: GitHead,
): GitRemoteBranch[] {
  const going = new Set(names);
  return refs.remoteBranches.filter((remoteBranch) => {
    const trackers = refs.branches.filter((branch) => branch.upstream === remoteBranch.name);
    return (
      trackers.some((branch) => going.has(branch.name)) &&
      trackers.every((branch) => going.has(branch.name)) &&
      !keptReason(remoteBranch, refs, head)
    );
  });
}

/** Remote branches grouped by their remote, one push each. */
export function byRemote(remoteBranches: ReadonlyArray<GitRemoteBranch>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const branch of remoteBranches) {
    groups.set(branch.remote, [...(groups.get(branch.remote) ?? []), branch.shortName]);
  }
  return groups;
}
