/**
 * A unified diff of one file as `git diff` prints it, and the patches built
 * from parts of it. `git apply` takes those on stdin, so a hunk or a few
 * lines can be staged, unstaged or discarded without touching the rest.
 */

export type GitHunkLineKind = "context" | "add" | "del";

export type GitHunkLine = {
  readonly kind: GitHunkLineKind;
  /** Without the leading marker character. */
  readonly text: string;
  /** Line number in the old file; absent for an added line. */
  readonly oldNumber?: number;
  /** Line number in the new file; absent for a deleted line. */
  readonly newNumber?: number;
  /** The line has no newline at the end of the file. */
  readonly noNewline?: boolean;
};

export type GitHunk = {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  /** The function or section git prints after the ranges. */
  readonly heading: string;
  readonly lines: ReadonlyArray<GitHunkLine>;
};

export type GitPatch = {
  /** `diff --git`, `index`, `---`, `+++` and the like, verbatim. */
  readonly header: ReadonlyArray<string>;
  readonly hunks: ReadonlyArray<GitHunk>;
  readonly binary: boolean;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

/** Reads one file's unified diff; an empty diff gives no hunks. */
export function parseGitPatch(raw: string): GitPatch {
  const header: string[] = [];
  const hunks: GitHunk[] = [];
  let binary = false;
  let current: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    heading: string;
    lines: GitHunkLine[];
  } | null = null;
  let oldNumber = 0;
  let newNumber = 0;

  const lines = raw.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  for (const line of lines) {
    const match = HUNK_HEADER.exec(line);
    if (match) {
      current = {
        oldStart: Number(match[1]),
        oldLines: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newLines: match[4] === undefined ? 1 : Number(match[4]),
        heading: match[5] ?? "",
        lines: [],
      };
      oldNumber = current.oldStart;
      newNumber = current.newStart;
      hunks.push(current);
      continue;
    }
    if (!current) {
      header.push(line);
      if (/^Binary files .* differ$/.test(line) || line.startsWith("GIT binary patch"))
        binary = true;
      continue;
    }
    if (line.startsWith("\\")) {
      const last = current.lines[current.lines.length - 1];
      if (last) current.lines[current.lines.length - 1] = { ...last, noNewline: true };
      continue;
    }
    const marker = line[0];
    const text = line.slice(1);
    if (marker === "+") {
      current.lines.push({ kind: "add", text, newNumber: newNumber++ });
    } else if (marker === "-") {
      current.lines.push({ kind: "del", text, oldNumber: oldNumber++ });
    } else {
      current.lines.push({ kind: "context", text, oldNumber: oldNumber++, newNumber: newNumber++ });
    }
  }

  return { header, hunks, binary };
}

/**
 * A patch of one hunk, or of the chosen lines in it: an added line that is
 * not chosen is left out, a deleted one that is not chosen stays as context.
 * `null` when nothing in the hunk is chosen.
 */
export function buildHunkPatch(
  patch: GitPatch,
  hunk: GitHunk,
  chosen?: ReadonlySet<number>,
): string | null {
  const lines: GitHunkLine[] = [];
  let oldLines = 0;
  let newLines = 0;
  let anyChange = false;
  hunk.lines.forEach((line, index) => {
    const picked = chosen === undefined || chosen.has(index);
    if (line.kind === "add") {
      if (!picked) return;
      anyChange = true;
      lines.push(line);
      newLines++;
    } else if (line.kind === "del") {
      if (picked) {
        anyChange = true;
        lines.push(line);
        oldLines++;
      } else {
        lines.push({ ...line, kind: "context" });
        oldLines++;
        newLines++;
      }
    } else {
      lines.push(line);
      oldLines++;
      newLines++;
    }
  });
  if (!anyChange) return null;

  const fileHeader = patch.header.filter((line) => !line.startsWith("index "));
  const heading = hunk.heading ? ` ${hunk.heading}` : "";
  const hunkHeader = `@@ -${hunk.oldStart},${oldLines} +${hunk.newStart},${newLines} @@${heading}`;
  const body = lines.flatMap((line) => {
    const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
    const rendered = [`${marker}${line.text}`];
    if (line.noNewline) rendered.push("\\ No newline at end of file");
    return rendered;
  });
  return `${[...fileHeader, hunkHeader, ...body].join("\n")}\n`;
}
