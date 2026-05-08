const PROMPT_MARKER_LINE_REGEX = /^\^\^#\d+.*(?:\r?\n|$)/gm;

export function isPromptMarkerLine(lineText: string): boolean {
  return /^\^\^#\d+/.test(lineText);
}

export function sanitizePromptMarkerText(text: string): string {
  return text.replace(PROMPT_MARKER_LINE_REGEX, "");
}

export function findLastPromptMarkerLine(buffer: {
  length: number;
  getLine(y: number): { translateToString(): string } | undefined;
}): number {
  for (let lineIndex = buffer.length - 1; lineIndex >= 0; lineIndex--) {
    const line = buffer.getLine(lineIndex);
    if (line && isPromptMarkerLine(line.translateToString())) return lineIndex;
  }
  return -1;
}
