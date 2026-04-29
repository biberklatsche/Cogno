const PROMPT_MARKER_LINE_REGEX = /^\^\^#\d+.*(?:\r?\n|$)/gm;

export function isPromptMarkerLine(lineText: string): boolean {
  return /^\^\^#\d+/.test(lineText);
}

export function sanitizePromptMarkerText(text: string): string {
  return text.replace(PROMPT_MARKER_LINE_REGEX, "");
}
