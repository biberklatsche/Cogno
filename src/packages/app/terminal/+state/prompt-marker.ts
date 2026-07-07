const PROMPT_MARKER_LINE_REGEX = /^\^\^#\d+.*(?:\r?\n|$)/gm;

export function isPromptMarkerLine(lineText: string): boolean {
  return /^\^\^#\d+/.test(lineText);
}

export function sanitizePromptMarkerText(text: string): string {
  return text.replace(PROMPT_MARKER_LINE_REGEX, "");
}

export function findLastPromptMarkerLine(
  buffer: {
    length: number;
    getLine(y: number): { translateToString(): string } | undefined;
  },
  maxScanLines: number = Number.POSITIVE_INFINITY,
): number {
  // The marker of the current prompt always sits close to the buffer end, so
  // callers on hot paths must cap the scan — an unbounded scan walks the whole
  // scrollback (default 100k lines) when no marker line matches.
  const lowestLineIndex = Math.max(0, buffer.length - maxScanLines);
  for (let lineIndex = buffer.length - 1; lineIndex >= lowestLineIndex; lineIndex--) {
    const line = buffer.getLine(lineIndex);
    if (line && isPromptMarkerLine(line.translateToString())) return lineIndex;
  }
  return -1;
}
