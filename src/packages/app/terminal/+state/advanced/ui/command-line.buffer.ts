import { Terminal } from "@xterm/xterm";
import { PromptMarkerRegistry } from "./prompt-marker.registry";

export type InputRange = { startIndex: number; endIndex: number };

const PROMPT_MARKER_LINE_REGEX = /^\^\^#\d+.*(?:\r?\n|$)/gm;

function sanitizePromptMarkerText(text: string): string {
  return text.replace(PROMPT_MARKER_LINE_REGEX, "");
}

/**
 * The single read surface over the xterm buffer for the shell's current input
 * line. Translates between xterm's cell/line world and input indices
 * (positions within the typed command). Handlers never do marker lookups,
 * buffer-coordinate math or selection mapping themselves — pty-side input
 * mutation lives in TerminalInputWriter instead.
 */
export class CommandLineBuffer {
  private _terminal?: Terminal;

  constructor(private readonly markerRegistry: PromptMarkerRegistry) {}

  /** Idempotent; handlers call this from registerTerminal. */
  setTerminal(terminal: Terminal): void {
    this._terminal = terminal;
    this.markerRegistry.setTerminal(terminal);
  }

  get cols(): number {
    return this._terminal?.cols ?? 1;
  }

  /** Absolute buffer line of the current prompt's `^^#<id>` marker. */
  lastPromptMarkerLine(): number {
    return this.markerRegistry.lastMarkerLine();
  }

  /** First buffer line of the current input (the line after the marker). */
  inputStartLine(): number {
    return this.lastPromptMarkerLine() + 1;
  }

  /**
   * Input index of the terminal cursor: its cell offset within the typed
   * command, counting the wrapped lines below the marker. -1 without a
   * terminal.
   */
  cursorInputIndex(): number {
    const buffer = this._terminal?.buffer?.active;
    if (!this._terminal || !buffer) return -1;
    const cursorLine = buffer.cursorY + buffer.viewportY;
    const rowsBelowInputStart = cursorLine - this.inputStartLine();
    return buffer.cursorX + this._terminal.cols * rowsBelowInputStart;
  }

  /** Current input text, read from the (possibly wrapped) lines below the marker. */
  readInputText(maxCursorIndex: number): string {
    const buffer = this._terminal?.buffer?.active;
    if (!this._terminal || !buffer) return "";
    const lastMarkerLine = this.lastPromptMarkerLine();
    const heightOfPrompt = Math.ceil(maxCursorIndex / this._terminal.cols);
    let text = "";
    for (let i = lastMarkerLine + 1; i <= lastMarkerLine + heightOfPrompt; i++) {
      const line = buffer.getLine(i);
      if (!line) continue;
      text += line.translateToString(false);
    }
    if (text.length > maxCursorIndex) {
      text = text.substring(0, maxCursorIndex);
    }
    return text.trimEnd();
  }

  /**
   * Maps the active xterm selection to input indices; undefined when there is
   * no selection or it reaches outside the input.
   */
  selectedInputRange(maxCursorIndex: number): InputRange | undefined {
    const selection = this._terminal?.getSelectionPosition();
    if (!this._terminal || !selection) return undefined;
    const startInputY = this.inputStartLine();
    const cols = this._terminal.cols;
    const startIndex = (selection.start.y - startInputY) * cols + selection.start.x;
    const endIndex = (selection.end.y - startInputY) * cols + selection.end.x;
    if (startIndex < 0 || endIndex > maxCursorIndex) return undefined;
    return { startIndex, endIndex };
  }

  /** Select `length` cells starting at input index `startIndex`. */
  selectInputSpan(startIndex: number, length: number): void {
    if (!this._terminal) return;
    const cols = this._terminal.cols;
    const row = Math.floor(startIndex / cols);
    const column = startIndex % cols;
    this._terminal.select(column, this.inputStartLine() + row, length);
  }

  hasSelection(): boolean {
    return this._terminal?.hasSelection() ?? false;
  }

  getSelection(): string {
    return this._terminal?.getSelection() ?? "";
  }

  clearSelection(): void {
    this._terminal?.clearSelection();
  }

  /** Strip `^^#` marker lines from text copied out of the buffer. */
  sanitizeCopiedText(text: string): string {
    return sanitizePromptMarkerText(text);
  }
}
