/**
 * A conflicted file as git leaves it in the working tree: the text both sides
 * agree on, and between the markers each conflict with the current side
 * (`<<<<<<<`), optionally the common base (`|||||||`, merge.conflictStyle
 * diff3/zdiff3) and the incoming side (`>>>>>>>`). Every piece keeps its line
 * endings, so a resolution writes the file back byte for byte as chosen.
 */

export type GitConflict = {
  readonly kind: "conflict";
  readonly ours: string;
  readonly theirs: string;
  /** What the marker lines name the sides: `HEAD`, a branch, a commit. */
  readonly oursLabel: string;
  readonly theirsLabel: string;
};

export type GitConflictSegment = { readonly kind: "text"; readonly text: string } | GitConflict;

/** What to keep of one conflict; `both` is the current side, then the incoming one. */
export type GitConflictChoice = "ours" | "theirs" | "both";

type Marker = "start" | "base" | "separator" | "end";

const MARKERS = new Map<string, Marker>([
  ["<", "start"],
  ["|", "base"],
  ["=", "separator"],
  [">", "end"],
]);

/** The marker a line is, with the label after it; git writes seven characters. */
function markerOf(line: string): { readonly marker: Marker; readonly label: string } | null {
  const bare = line.replace(/\r?\n$/, "");
  const match = /^(<{7}|\|{7}|={7}|>{7})(?: (.*))?$/.exec(bare);
  const marker = MARKERS.get(bare[0] ?? "");
  if (!match || !marker) return null;
  // A separator never carries a label; "======= x" is text.
  if (marker === "separator" && match[2] !== undefined) return null;
  return { marker, label: match[2] ?? "" };
}

/**
 * Splits the file into agreed text and conflicts. Markers that do not close
 * (a start without separator and end) stay text: what git did not write is
 * not taken apart.
 */
export function parseConflicts(text: string): ReadonlyArray<GitConflictSegment> {
  const lines = text.split(/(?<=\n)/);
  const segments: GitConflictSegment[] = [];
  let plain = "";
  let index = 0;
  while (index < lines.length) {
    const conflict = readConflict(lines, index);
    if (!conflict) {
      plain += lines[index];
      index += 1;
      continue;
    }
    if (plain) segments.push({ kind: "text", text: plain });
    plain = "";
    segments.push(conflict.conflict);
    index = conflict.next;
  }
  if (plain) segments.push({ kind: "text", text: plain });
  return segments;
}

function readConflict(
  lines: ReadonlyArray<string>,
  start: number,
): { readonly conflict: GitConflict; readonly next: number } | null {
  const opening = markerOf(lines[start] ?? "");
  if (opening?.marker !== "start") return null;
  let ours = "";
  let theirs = "";
  let part: "ours" | "base" | "theirs" = "ours";
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const marker = markerOf(line);
    if (marker?.marker === "start") return null;
    if (marker?.marker === "base" && part === "ours") {
      part = "base";
    } else if (marker?.marker === "separator" && part !== "theirs") {
      part = "theirs";
    } else if (marker?.marker === "end" && part === "theirs") {
      return {
        conflict: {
          kind: "conflict",
          ours,
          theirs,
          oursLabel: opening.label,
          theirsLabel: marker.label,
        },
        next: index + 1,
      };
    } else if (part === "ours") {
      ours += line;
    } else if (part === "theirs") {
      theirs += line;
    }
  }
  return null;
}

/** The conflicts alone, in file order. */
export function conflictsOf(segments: ReadonlyArray<GitConflictSegment>): GitConflict[] {
  return segments.filter((segment): segment is GitConflict => segment.kind === "conflict");
}

/**
 * The file with each conflict replaced by what was chosen for it; null while
 * a conflict has no choice yet.
 */
export function resolveConflicts(
  segments: ReadonlyArray<GitConflictSegment>,
  choices: ReadonlyArray<GitConflictChoice | null>,
): string | null {
  let result = "";
  let conflictIndex = 0;
  for (const segment of segments) {
    if (segment.kind === "text") {
      result += segment.text;
      continue;
    }
    const choice = choices[conflictIndex++];
    if (!choice) return null;
    result +=
      choice === "ours"
        ? segment.ours
        : choice === "theirs"
          ? segment.theirs
          : segment.ours + segment.theirs;
  }
  return result;
}
