import { ShellLineEditorDefinitionContract } from "@cogno/core-api";
import { IPty } from "./pty/pty";
import { TerminalStateManager } from "./state";

/** Builds an escape sequence that moves the cursor by `offset` columns. */
export function buildCursorMoveSequence(offset: number): string {
  if (offset === 0) return "";
  const direction = offset > 0 ? "\x1b[C" : "\x1b[D";
  return direction.repeat(Math.abs(offset));
}

/**
 * The single place that replaces the shell's current input line. Every
 * consumer that injects a full command (autocomplete, history recall,
 * paste-over-selection, composer) must go through this class so the
 * native-vs-raw branching, the insert sanitizing and the multiline safety
 * live exactly once.
 */
export class TerminalInputReplacer {
  constructor(
    private readonly pty: IPty,
    private readonly stateManager: TerminalStateManager,
    private readonly lineEditor?: ShellLineEditorDefinitionContract,
  ) {}

  /**
   * Replaces the whole current input with `text`, placing the cursor at
   * `cursorIndex`. Returns true when the shell integration handled the
   * replacement natively (including the submit for `autoExecute`).
   */
  replaceInput(text: string, cursorIndex: number, autoExecute?: boolean): boolean {
    const sanitizer = this.lineEditor?.insertSanitizer;
    const prepared = sanitizer ? sanitizer.prepareInsert(text, cursorIndex) : { text, cursorIndex };

    if (this.lineEditor?.nativeActionsViaShellIntegration?.includes("replaceCurrentInput")) {
      // The native path submits by injecting a synthetic Enter keystroke
      // itself (see line-editor.ps1.txt) so the shell integration process
      // applies replace-then-submit atomically and in order. Writing "\r"
      // here separately would race the pipe round-trip and could submit the
      // buffer before the replace was applied.
      this.pty.executeLineEditorAction("replaceCurrentInput", {
        text: prepared.text,
        cursorIndex: prepared.cursorIndex,
        autoExecute,
      });
      return true;
    }

    const input = this.stateManager.input;
    const countToEnd = input.text.length - input.cursorIndex;
    this.pty.write(buildCursorMoveSequence(countToEnd) + "\b".repeat(input.text.length));
    this.pty.write(this.wrapForRawInsert(prepared.text));

    const targetIndex = Math.max(0, Math.min(prepared.cursorIndex, prepared.text.length));
    const leftToTarget = prepared.text.length - targetIndex;
    if (leftToTarget > 0) {
      this.pty.write(buildCursorMoveSequence(-leftToTarget));
    }

    if (autoExecute) {
      queueMicrotask(() => this.pty.write("\r"));
    }
    return false;
  }

  /**
   * Even without a shell-specific sanitizer, remaining newlines must never be
   * written raw — they would act as accept-line. Bracketed paste is the
   * conservative fallback: shells without support show garbage, but never
   * execute the lines.
   */
  private wrapForRawInsert(text: string): string {
    const sanitizer = this.lineEditor?.insertSanitizer;
    if (sanitizer) return sanitizer.wrapForPtyWrite(text);
    return text.includes("\n") ? `\x1b[200~${text}\x1b[201~` : text;
  }
}
