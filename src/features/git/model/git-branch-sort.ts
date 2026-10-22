import { GitBranch, GitRefs, GitRemoteBranch } from "./git-model";

/** How a branch list is ordered; the default branches stay on top in every order. */
export type GitBranchSort = "date-desc" | "date-asc" | "name-asc" | "name-desc";

/** The orders a click on the sort button steps through, the default first. */
const SORT_CYCLE: ReadonlyArray<GitBranchSort> = ["date-desc", "date-asc", "name-asc", "name-desc"];

/** Default branches even when nobody configured `origin/HEAD`. */
const USUAL_DEFAULT_BRANCHES = ["main", "master"];

export function nextSort(sort: GitBranchSort): GitBranchSort {
  return SORT_CYCLE[(SORT_CYCLE.indexOf(sort) + 1) % SORT_CYCLE.length] as GitBranchSort;
}

/** `feature/x` for both `feature/x` and `origin/feature/x`. */
export function shortName(branch: GitBranch | GitRemoteBranch): string {
  return "remote" in branch ? branch.shortName : branch.name;
}

/** A branch a remote's `HEAD` points at, or one named `main` or `master`. */
export function isDefaultBranch(branch: GitBranch | GitRemoteBranch, refs: GitRefs): boolean {
  const name = shortName(branch);
  return refs.defaultBranches.includes(name) || USUAL_DEFAULT_BRANCHES.includes(name);
}

/** The branches in `sort` order, the default branches first; ties go by name. */
export function sortBranches<T extends GitBranch | GitRemoteBranch>(
  branches: ReadonlyArray<T>,
  sort: GitBranchSort,
  refs: GitRefs,
): T[] {
  const byName = (a: T, b: T) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "date-desc":
        return b.lastCommitAt - a.lastCommitAt || byName(a, b);
      case "date-asc":
        return a.lastCommitAt - b.lastCommitAt || byName(a, b);
      case "name-asc":
        return byName(a, b);
      case "name-desc":
        return byName(b, a);
    }
  };
  return [...branches].sort(
    (a, b) => Number(isDefaultBranch(b, refs)) - Number(isDefaultBranch(a, refs)) || compare(a, b),
  );
}
