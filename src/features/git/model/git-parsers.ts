import {
  GitBranch,
  GitCommit,
  GitCommitDetail,
  GitFile,
  GitFileStatus,
  GitHead,
  GitRefLabel,
  GitRefs,
  GitRemoteBranch,
  GitStash,
  GitStatus,
  GitTag,
  GitWorktree,
} from "./git-model";

/** Field and record separators the format strings below ask git to emit. */
const FIELD = "\x1f";
const RECORD = "\x1e";

export const LOG_FORMAT = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1e";
export const COMMIT_DETAIL_FORMAT = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ct%x1f%B";
export const REF_FORMAT =
  "%(refname)%1f%(objectname)%1f%(*objectname)%1f%(upstream:short)%1f%(upstream:track,nobracket)%1f%(committerdate:unix)%1f%(symref)%1f%(numparent)";
export const STASH_FORMAT = "%H%x1f%gd%x1f%at%x1f%gs";

/** Both sides of an unmerged path, as `git status` prints them. */
const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/**
 * Reads `git status --porcelain=v1 -z`: entries end in NUL and paths come
 * verbatim - no quoting, spaces and umlauts as they are. A rename or copy is
 * followed by its source path as an entry of its own.
 */
export function parseGitStatus(raw: string): GitStatus {
  const staged: GitFile[] = [];
  const unstaged: GitFile[] = [];
  const untracked: GitFile[] = [];
  const conflicted: GitFile[] = [];

  const entries = raw.split("\0");
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index] ?? "";
    if (entry.length < 4) continue;
    const x = entry[0] ?? " ";
    const y = entry[1] ?? " ";
    const path = entry.slice(3);
    let oldPath: string | undefined;
    if (x === "R" || x === "C" || y === "R" || y === "C") {
      index++;
      oldPath = entries[index];
    }

    if (x === "?" && y === "?") {
      const isDirectory = path.endsWith("/");
      untracked.push({ path: isDirectory ? path.slice(0, -1) : path, status: "?", isDirectory });
      continue;
    }
    if (CONFLICT_CODES.has(`${x}${y}`)) {
      conflicted.push({ path, status: "U", isDirectory: false });
      continue;
    }

    if (x !== " " && x !== "?") {
      staged.push(withOldPath({ path, status: toStatus(x), isDirectory: false }, x, oldPath));
    }
    if (y !== " " && y !== "?") {
      unstaged.push(withOldPath({ path, status: toStatus(y), isDirectory: false }, y, oldPath));
    }
  }

  return { staged, unstaged, untracked, conflicted };
}

function withOldPath(file: GitFile, code: string, oldPath: string | undefined): GitFile {
  return (code === "R" || code === "C") && oldPath ? { ...file, oldPath } : file;
}

function toStatus(char: string): GitFileStatus {
  const known: Record<string, GitFileStatus> = { A: "A", D: "D", R: "R", C: "C" };
  return known[char] ?? "M";
}

/** Reads `git for-each-ref` with `REF_FORMAT` over heads, remotes and tags. */
export function parseRefs(raw: string): GitRefs {
  const branches: GitBranch[] = [];
  const remoteBranches: GitRemoteBranch[] = [];
  const tags: GitTag[] = [];
  const defaultBranches = new Set<string>();

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [
      refname = "",
      objectname = "",
      peeled = "",
      upstream = "",
      track = "",
      committed = "",
      symref = "",
      parents = "",
    ] = line.split(FIELD);
    const lastCommitAt = Number(committed) || 0;
    if (refname.startsWith("refs/heads/")) {
      branches.push({
        name: refname.slice("refs/heads/".length),
        sha: objectname,
        upstream: upstream || null,
        ...parseTrack(track),
        lastCommitAt,
        tipIsMerge: Number(parents) > 1,
      });
    } else if (refname.startsWith("refs/remotes/")) {
      const name = refname.slice("refs/remotes/".length);
      const slash = name.indexOf("/");
      if (slash === -1) continue;
      // `origin/HEAD` is a pointer to the remote's default branch, not a branch.
      if (name.endsWith("/HEAD")) {
        const target = symref.slice(`refs/remotes/${name.slice(0, slash)}/`.length);
        if (symref && target) defaultBranches.add(target);
        continue;
      }
      remoteBranches.push({
        name,
        remote: name.slice(0, slash),
        shortName: name.slice(slash + 1),
        sha: objectname,
        lastCommitAt,
      });
    } else if (refname.startsWith("refs/tags/")) {
      tags.push({ name: refname.slice("refs/tags/".length), sha: peeled || objectname });
    }
  }

  return { branches, remoteBranches, tags, defaultBranches: [...defaultBranches] };
}

/** Reads `%(upstream:track,nobracket)`: "ahead 1, behind 2", "gone" or "". */
export function parseTrack(track: string): Pick<GitBranch, "ahead" | "behind" | "upstreamGone"> {
  const ahead = /ahead (\d+)/.exec(track);
  const behind = /behind (\d+)/.exec(track);
  return {
    ahead: ahead ? Number(ahead[1]) : 0,
    behind: behind ? Number(behind[1]) : 0,
    upstreamGone: track.trim() === "gone",
  };
}

/**
 * Reads `git push --porcelain`: one tab-separated line per ref with a flag
 * and a summary. `!` with `[rejected]` is git refusing a push that is not a
 * fast-forward (or whose lease is stale), which a force push can override; a
 * `[remote rejected]` from a hook cannot be.
 */
export function isPushRejected(stdout: string): boolean {
  return stdout.split("\n").some((line) => {
    const [flag, , summary = ""] = line.split("\t");
    return flag === "!" && summary.startsWith("[rejected]");
  });
}

/** Reads `git stash list` with `STASH_FORMAT`. */
export function parseStashes(raw: string): GitStash[] {
  const stashes: GitStash[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [sha = "", ref = "", time = "0", message = ""] = line.split(FIELD);
    const index = Number(/\{(\d+)\}/.exec(ref)?.[1] ?? stashes.length);
    stashes.push({ index, ref, sha, message, timestamp: Number(time) });
  }
  return stashes;
}

/** Reads `git log` with `LOG_FORMAT`. */
export function parseLog(raw: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const record of raw.split(RECORD)) {
    const trimmed = record.replace(/^\n+/, "");
    if (!trimmed) continue;
    const [sha = "", parents = "", author = "", email = "", time = "0", subject = ""] =
      trimmed.split(FIELD);
    if (!sha) continue;
    commits.push({
      sha,
      parents: parents ? parents.split(" ") : [],
      author,
      email,
      timestamp: Number(time),
      subject,
    });
  }
  return commits;
}

/**
 * Reads `git diff-tree -r -z --name-status`: a status token, then the path -
 * two paths (source, target) for a rename or copy, whose token carries a score
 * (`R100`).
 */
export function parseNameStatus(raw: string): GitFile[] {
  const files: GitFile[] = [];
  const tokens = raw.split("\0");
  for (let index = 0; index < tokens.length; index++) {
    const code = tokens[index] ?? "";
    if (!code) continue;
    const letter = code[0] ?? "M";
    if (letter === "R" || letter === "C") {
      const oldPath = tokens[index + 1] ?? "";
      const path = tokens[index + 2] ?? "";
      index += 2;
      files.push({ path, oldPath, status: letter, isDirectory: false });
      continue;
    }
    const path = tokens[index + 1] ?? "";
    index += 1;
    if (!path) continue;
    files.push({ path, status: toStatus(letter), isDirectory: false });
  }
  return files;
}

/** Reads `git show -s` with `COMMIT_DETAIL_FORMAT`; the message is the rest. */
export function parseCommitDetail(
  raw: string,
  files: ReadonlyArray<GitFile>,
): GitCommitDetail | null {
  const parts = raw.split(FIELD);
  if (parts.length < 8) return null;
  const [sha = "", parents = "", author = "", email = "", authorTime = "0", committer = ""] = parts;
  return {
    sha,
    parents: parents ? parents.split(" ") : [],
    author,
    email,
    authorTime: Number(authorTime),
    committer,
    commitTime: Number(parts[6] ?? "0"),
    message: parts.slice(7).join(FIELD).trimEnd(),
    files,
  };
}

/**
 * The labels each commit carries in the graph, keyed by commit sha. A remote
 * branch of the same name on the same commit folds into the local branch's
 * label, as GitKraken shows it: one name, both icons.
 */
export function buildRefLabels(refs: GitRefs, head: GitHead): Map<string, GitRefLabel[]> {
  const labels = new Map<string, GitRefLabel[]>();
  const add = (sha: string, label: GitRefLabel) => {
    const list = labels.get(sha);
    if (list) list.push(label);
    else labels.set(sha, [label]);
  };
  const folded = new Set<string>();
  for (const branch of refs.branches) {
    const remotes = refs.remoteBranches
      .filter((remote) => remote.shortName === branch.name && remote.sha === branch.sha)
      .map((remote) => remote.name);
    for (const name of remotes) folded.add(name);
    add(branch.sha, {
      kind: "branch",
      name: branch.name,
      isHead: branch.name === head.branch,
      remotes,
      ...(branch.worktree ? { worktree: branch.worktree } : {}),
    });
  }
  for (const remoteBranch of refs.remoteBranches) {
    if (folded.has(remoteBranch.name)) continue;
    add(remoteBranch.sha, { kind: "remote", name: remoteBranch.name, isHead: false, remotes: [] });
  }
  for (const tag of refs.tags) {
    add(tag.sha, { kind: "tag", name: tag.name, isHead: false, remotes: [] });
  }
  return labels;
}

/**
 * Reads `git worktree list --porcelain -z`: attribute lines end in NUL, and an
 * empty one ends a worktree. The first is the main worktree; `root` (the
 * panel's `--show-toplevel`) tells which one is current.
 */
export function parseWorktrees(raw: string, root: string): GitWorktree[] {
  const worktrees: GitWorktree[] = [];
  let lines: string[] = [];
  const flush = () => {
    const path = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    if (path !== undefined) {
      const branchRef = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length);
      const head = lines.find((line) => line.startsWith("HEAD "))?.slice("HEAD ".length);
      worktrees.push({
        path,
        // Before the first commit git prints a HEAD of zeros.
        head: head && !/^0+$/.test(head) ? head : null,
        branch: branchRef?.startsWith("refs/heads/") ? branchRef.slice("refs/heads/".length) : null,
        isMain: worktrees.length === 0,
        isCurrent: samePath(path, root),
        locked: lines.some((line) => line === "locked" || line.startsWith("locked ")),
        prunable: lines.some((line) => line === "prunable" || line.startsWith("prunable ")),
      });
    }
    lines = [];
  };
  for (const line of raw.split("\0")) {
    if (line === "") flush();
    else lines.push(line);
  }
  flush();
  return worktrees;
}

/**
 * `refs` with each branch checked out in another worktree knowing that
 * worktree. The branch checked out here is never one of them, even when the
 * paths differ in a way `isCurrent` does not see (a symlink, a short name);
 * a worktree whose folder is gone has nothing checked out any more.
 */
export function withWorktrees(
  refs: GitRefs,
  worktrees: ReadonlyArray<GitWorktree>,
  headBranch: string | null,
): GitRefs {
  const elsewhere = new Map<string, string>();
  for (const worktree of worktrees) {
    const { branch } = worktree;
    if (!branch || branch === headBranch || worktree.isCurrent || worktree.prunable) continue;
    elsewhere.set(branch, worktree.path);
  }
  if (elsewhere.size === 0) return refs;
  return {
    ...refs,
    branches: refs.branches.map((branch) => {
      const worktree = elsewhere.get(branch.name);
      return worktree ? { ...branch, worktree } : branch;
    }),
  };
}

/** The last folder of a path, either separator. */
export function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/**
 * Whether two paths git printed name the same folder: either separator, no
 * trailing one, and a Windows drive path in any case.
 */
function samePath(a: string, b: string): boolean {
  const normalized = (path: string) => {
    const unified = path.replace(/\\/g, "/").replace(/\/+$/, "");
    return /^[A-Za-z]:/.test(unified) ? unified.toLowerCase() : unified;
  };
  return normalized(a) === normalized(b);
}

/** The directory name `git clone <url>` creates when none is given. */
export function cloneDirectoryName(url: string): string {
  const trimmed = url.trim().replace(/[\\/]+$/, "");
  const last = trimmed.split(/[\\/:]/).pop() ?? "";
  return last.replace(/\.git$/, "");
}

/** One version of a conflicted file in the index. */
export type GitConflictStage = { readonly mode: string; readonly blob: string };

/** 1 the common base, 2 the current side, 3 the incoming one. */
export type GitConflictStages = ReadonlyMap<1 | 2 | 3, GitConflictStage>;

/**
 * Reads `git ls-files -u -z` for one path: the version per stage git still
 * holds. A side that deleted the file has no stage.
 */
export function parseUnmergedStages(raw: string): GitConflictStages {
  const stages = new Map<1 | 2 | 3, GitConflictStage>();
  for (const entry of raw.split("\0")) {
    const [, mode, blob, stage] = /^(\d+) ([0-9a-f]+) ([123])\t/.exec(entry) ?? [];
    if (mode && blob && stage) stages.set(Number(stage) as 1 | 2 | 3, { mode, blob });
  }
  return stages;
}

/**
 * The branches, tag or commit a merge brings in, as `MERGE_MSG` names them
 * ("Merge branch 'feature'", "Merge remote-tracking branch 'origin/x'",
 * "Merge branches 'a' and 'b'"); several are listed comma-separated.
 */
export function mergeSourceOf(message: string): string | null {
  const firstLine = message.split("\n")[0] ?? "";
  const kind =
    /^Merge (?:remote-tracking branches|remote-tracking branch|branches|branch|tags|tag|commits|commit) /;
  if (!kind.test(firstLine)) return null;
  // The quoted names, not the branch after " into ".
  const names = [...firstLine.replace(/ into [^']*$/, "").matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  );
  return names.length > 0 ? names.join(", ") : null;
}
