import { GitFile } from "./git-model";

export type GitFileTreeRow =
  | { readonly kind: "dir"; readonly path: string; readonly name: string; readonly depth: number }
  | {
      readonly kind: "file";
      readonly file: GitFile;
      readonly name: string;
      readonly depth: number;
    };

type Node = { dirs: Map<string, Node>; files: GitFile[] };

/**
 * The files as a folder tree, flattened to rows in display order: folders
 * first, then files, each sorted by name. A folder with a single subfolder and
 * no files of its own is merged into one row (`src/app`). Rows below a
 * collapsed folder are left out.
 */
export function buildFileTree(
  files: ReadonlyArray<GitFile>,
  collapsed: ReadonlySet<string> = new Set(),
): GitFileTreeRow[] {
  const root: Node = { dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    let node = root;
    for (const part of parts) {
      let child = node.dirs.get(part);
      if (!child) {
        child = { dirs: new Map(), files: [] };
        node.dirs.set(part, child);
      }
      node = child;
    }
    node.files.push(file);
  }

  const rows: GitFileTreeRow[] = [];
  const walk = (node: Node, prefix: string, depth: number) => {
    for (const [name, child] of [...node.dirs].sort(([a], [b]) => a.localeCompare(b))) {
      let label = name;
      let current = child;
      while (current.files.length === 0 && current.dirs.size === 1) {
        const [nextName, next] = [...current.dirs][0] as [string, Node];
        label = `${label}/${nextName}`;
        current = next;
      }
      const path = prefix ? `${prefix}/${label}` : label;
      rows.push({ kind: "dir", path, name: label, depth });
      if (!collapsed.has(path)) walk(current, path, depth + 1);
    }
    for (const file of [...node.files].sort((a, b) => a.path.localeCompare(b.path))) {
      rows.push({ kind: "file", file, name: file.path.split("/").pop() ?? file.path, depth });
    }
  };
  walk(root, "", 0);
  return rows;
}
