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

export type GitConflictSide = "ours" | "theirs";

/** The sides taken for one conflict, in the order they were taken; empty while undecided. */
export type GitConflictPick = ReadonlyArray<GitConflictSide>;

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

export type GitConflictResolution = {
  readonly text: string;
  /** Where each conflict's taken text starts in `text`, for jumping to it. */
  readonly starts: ReadonlyArray<number>;
};

/**
 * The file with each conflict replaced by the sides taken for it, in the
 * order they were taken; a conflict nothing was taken for leaves nothing.
 */
export function resolveConflicts(
  segments: ReadonlyArray<GitConflictSegment>,
  picks: ReadonlyArray<GitConflictPick | undefined>,
): GitConflictResolution {
  let text = "";
  const starts: number[] = [];
  let conflictIndex = 0;
  for (const segment of segments) {
    if (segment.kind === "text") {
      text += segment.text;
      continue;
    }
    starts.push(text.length);
    for (const side of picks[conflictIndex++] ?? []) text += segment[side];
  }
  return { text, starts };
}

/** One line of a side as the conflict view shows it, aligned with the other side. */
export type GitConflictRow = {
  /** Empty for a filler that keeps both sides level. */
  readonly text: string;
  /** The line number in that side's version; null for a filler. */
  readonly number: number | null;
  /** The conflict the line belongs to; null for agreed text. */
  readonly conflict: number | null;
  /** The first row of its conflict, which carries the checkbox. */
  readonly first: boolean;
};

/**
 * One side of the file, line by line, each conflict padded with fillers to
 * the length of the longer side so both sides scroll level. A conflict with
 * nothing on either side still gets a row, for its checkbox.
 */
export function conflictRows(
  segments: ReadonlyArray<GitConflictSegment>,
  side: GitConflictSide,
): GitConflictRow[] {
  const rows: GitConflictRow[] = [];
  let number = 1;
  let conflictIndex = 0;
  for (const segment of segments) {
    if (segment.kind === "text") {
      for (const text of linesOf(segment.text)) {
        rows.push({ text, number: number++, conflict: null, first: false });
      }
      continue;
    }
    const own = linesOf(segment[side]);
    const other = linesOf(segment[side === "ours" ? "theirs" : "ours"]);
    const height = Math.max(own.length, other.length, 1);
    for (let index = 0; index < height; index++) {
      const text = own[index];
      rows.push({
        text: text ?? "",
        number: text === undefined ? null : number++,
        conflict: conflictIndex,
        first: index === 0,
      });
    }
    conflictIndex++;
  }
  return rows;
}

/** The lines of a piece of the file, without their endings. */
function linesOf(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}
