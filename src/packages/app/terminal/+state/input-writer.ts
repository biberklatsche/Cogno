import {
  ShellLineEditorActionContract,
  ShellLineEditorDefinitionContract,
  ShellSessionCapabilitiesContract,
} from "@cogno/core-api";
import { IPty } from "./pty/pty";
import { TerminalStateManager } from "./state";

/** Builds an escape sequence that moves the cursor by `offset` columns. */
function buildCursorMoveSequence(offset: number): string {
  if (offset === 0) return "";
  const direction = offset > 0 ? "\x1b[C" : "\x1b[D";
  return direction.repeat(Math.abs(offset));
}

/**
 * A native line-editor action is only available when the static shell
 * definition supports it AND the running session reported it in the
 * capability handshake. Whether the integration actually works (shell
 * version, PSReadLine present, platform) is per-session knowledge; before the
 * handshake arrives every consumer must use the raw fallback.
 */
function isNativeActionAvailable(
  action: ShellLineEditorActionContract,
  lineEditor: ShellLineEditorDefinitionContract | undefined,
  sessionCapabilities: ShellSessionCapabilitiesContract | undefined,
): boolean {
  if (!lineEditor?.nativeActionsViaShellIntegration?.includes(action)) return false;
  return sessionCapabilities?.nativeActions.includes(action) ?? false;
}

/**
 * The single place that mutates the shell's current input line via the pty.
 * Every consumer that moves the cursor, deletes characters or injects a full
 * command (autocomplete, history recall, paste-over-selection, composer)
 * must go through this class so the native-vs-raw branching, the insert
 * sanitizing and the multiline safety live exactly once.
 */
export class TerminalInputWriter {
  constructor(
    private readonly pty: IPty,
    private readonly stateManager: TerminalStateManager,
    private readonly lineEditor?: ShellLineEditorDefinitionContract,
  ) {}

  /** Move the cursor by `offset` columns (negative = left). */
  moveCursor(offset: number): void {
    if (offset === 0) return;
    this.pty.write(buildCursorMoveSequence(offset));
  }

  /**
   * Move the cursor `offsetToRangeEnd` columns to the right end of the
   * doomed range, then erase `count` chars backwards — emitted as one pty
   * write so the shell echo cannot interleave.
   */
  deleteChars(offsetToRangeEnd: number, count: number): void {
    if (count <= 0) return;
    this.pty.write(buildCursorMoveSequence(offsetToRangeEnd) + "\b".repeat(count));
  }

  /** True when the shell integration can run `actionId` natively this session. */
  isNativeActionAvailable(actionId: ShellLineEditorActionContract): boolean {
    return isNativeActionAvailable(
      actionId,
      this.lineEditor,
      this.stateManager.sessionCapabilities,
    );
  }

  /** Dispatch a native line-editor action to the shell integration process. */
  executeNativeAction(actionId: ShellLineEditorActionContract, payload?: object): void {
    this.pty.executeLineEditorAction(actionId, payload);
  }

  /**
   * Replaces the whole current input with `text`, placing the cursor at
   * `cursorIndex`. Returns true when the shell integration handled the
   * replacement natively (including the submit for `autoExecute`).
   */
  replaceInput(text: string, cursorIndex: number, autoExecute?: boolean): boolean {
    const sanitizer = this.lineEditor?.insertSanitizer;
    const prepared = sanitizer ? sanitizer.prepareInsert(text, cursorIndex) : { text, cursorIndex };

    // Capture the on-screen input before signalling the command start: the
    // raw path derives its clear sequence from it, and startCommand() resets
    // the state manager's input.
    const currentInput = this.stateManager.input;

    if (autoExecute) {
      // A real Enter keypress is what normally flips `isCommandRunning` (via
      // xterm's `onKey`, see CommandLineObserver) and triggers the busy
      // animation. Auto-execute submits programmatically — no DOM keydown
      // ever fires — so signal the same state transition explicitly.
      this.stateManager.startCommand(prepared.text);
    }

    if (
      isNativeActionAvailable(
        "replaceCurrentInput",
        this.lineEditor,
        this.stateManager.sessionCapabilities,
      )
    ) {
      // The native path submits by injecting a synthetic Enter keystroke
      // itself (see line-editor.ps1.txt) so the shell integration process
      // applies replace-then-submit atomically and in order. Writing "\r"
      // here separately would race the pipe round-trip and could submit the
      // buffer before the replace was applied.
      this.executeNativeAction("replaceCurrentInput", {
        text: prepared.text,
        cursorIndex: prepared.cursorIndex,
        autoExecute,
      });
      return true;
    }

    const countToEnd = currentInput.text.length - currentInput.cursorIndex;
    this.deleteChars(countToEnd, currentInput.text.length);
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
