/**
 * A suggestion's `source` names where it came from; after dedupe several are
 * joined with " + ". Everything from the user's own past (`history-cmd`,
 * `history-cmd-local`, `history-dir`, `history-pattern`, `history-collapse`)
 * is history, the rest (`spec-cmd`) is context.
 */
export function isHistorySource(source: string): boolean {
  return sourceParts(source).some((part) => part.startsWith("history-"));
}

/** A command run in the current directory before. */
export function isLocalHistorySource(source: string): boolean {
  return sourceParts(source).includes("history-cmd-local");
}

function sourceParts(source: string): string[] {
  return source.split("+").map((part) => part.trim());
}
