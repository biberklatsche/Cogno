/** One-letter status of a file as git reports it; `U` is an unresolved conflict. */
export type GitFileStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?";

export type GitFile = {
  readonly path: string;
  /** The source path of a rename or copy. */
  readonly oldPath?: string;
  readonly status: GitFileStatus;
  readonly isDirectory: boolean;
};

export type GitStatus = {
  readonly staged: ReadonlyArray<GitFile>;
  readonly unstaged: ReadonlyArray<GitFile>;
  readonly untracked: ReadonlyArray<GitFile>;
  readonly conflicted: ReadonlyArray<GitFile>;
};

/** Where HEAD points: a branch, or a commit when detached; both null before the first commit. */
export type GitHead = {
  readonly sha: string | null;
  readonly branch: string | null;
};

export type GitBranch = {
  readonly name: string;
  readonly sha: string;
  readonly upstream: string | null;
  readonly ahead: number;
  readonly behind: number;
  /** The upstream is configured but no longer exists on the remote. */
  readonly upstreamGone: boolean;
  /** Committer date of the tip, in seconds. */
  readonly lastCommitAt: number;
  /** The tip has several parents; cherry pick and revert need `-m` for it. */
  readonly tipIsMerge: boolean;
};

export type GitRemoteBranch = {
  /** `origin/feature/x` */
  readonly name: string;
  readonly remote: string;
  /** `feature/x` */
  readonly shortName: string;
  readonly sha: string;
  /** Committer date of the tip, in seconds. */
  readonly lastCommitAt: number;
};

export type GitTag = {
  readonly name: string;
  /** The commit the tag points at, also for annotated tags. */
  readonly sha: string;
};

export type GitRefs = {
  readonly branches: ReadonlyArray<GitBranch>;
  readonly remoteBranches: ReadonlyArray<GitRemoteBranch>;
  readonly tags: ReadonlyArray<GitTag>;
  /** The branches the remotes' `HEAD` points at, as short names (`main`). */
  readonly defaultBranches: ReadonlyArray<string>;
};

export type GitRemote = {
  readonly name: string;
  readonly url: string;
};

export type GitStash = {
  readonly index: number;
  /** `stash@{0}` */
  readonly ref: string;
  readonly sha: string;
  readonly message: string;
  readonly timestamp: number;
};

export type GitCommit = {
  readonly sha: string;
  readonly parents: ReadonlyArray<string>;
  readonly author: string;
  readonly email: string;
  /** Seconds since the epoch. */
  readonly timestamp: number;
  readonly subject: string;
};

export type GitCommitDetail = {
  readonly sha: string;
  readonly parents: ReadonlyArray<string>;
  readonly author: string;
  readonly email: string;
  readonly authorTime: number;
  readonly committer: string;
  readonly commitTime: number;
  readonly message: string;
  readonly files: ReadonlyArray<GitFile>;
};

/** A label on a commit row in the graph. */
export type GitRefLabel = {
  readonly kind: "branch" | "remote" | "tag";
  readonly name: string;
  /** The branch HEAD points at. */
  readonly isHead: boolean;
  /** Remote branches of the same name on the same commit, folded into this label. */
  readonly remotes: ReadonlyArray<string>;
};

/** A multi-step operation git stopped in, waiting for the user. */
export type GitOperation = "merge" | "rebase" | "cherry-pick" | "revert";

/** What "Pull" does: fetch only, or fetch and merge, fast-forward only, or rebase. */
export type GitPullMode = "fetch" | "merge" | "ff-only" | "rebase";
