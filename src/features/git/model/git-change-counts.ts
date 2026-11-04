import { GitFile, GitStatus } from "./git-model";

/** How the working tree differs from HEAD, as files: new, changed, gone. */
export type GitChangeCounts = {
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
};

/**
 * Counts each path once, as the working tree has it against HEAD: a file
 * deleted in the working tree is gone whatever the index says, a new file
 * is new even when it was changed again after staging, everything else is
 * a change. Untracked directories count as one entry, as git lists them.
 */
export function countChanges(status: GitStatus): GitChangeCounts {
  const byPath = new Map<string, "added" | "modified" | "deleted">();
  const consider = (file: GitFile, kind: "added" | "modified" | "deleted") => {
    const known = byPath.get(file.path);
    if (known === "deleted") return;
    if (known === "added" && kind === "modified") return;
    byPath.set(file.path, kind);
  };
  for (const file of status.staged) consider(file, kindOf(file));
  for (const file of status.unstaged) consider(file, kindOf(file));
  for (const file of status.untracked) consider(file, "added");
  for (const file of status.conflicted) consider(file, "modified");

  const counts = { added: 0, modified: 0, deleted: 0 };
  for (const kind of byPath.values()) counts[kind] += 1;
  return counts;
}

function kindOf(file: GitFile): "added" | "modified" | "deleted" {
  if (file.status === "A" || file.status === "?") return "added";
  if (file.status === "D") return "deleted";
  return "modified";
}
