import { IPty } from "@cogno/core/terminal/pty";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import {
  ShellLineEditorActionContract,
  ShellLineEditorDefinitionContract,
} from "@cogno/shared/contributions";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { PromptMarkerRegistry } from "../decoration/prompt-marker.registry";
import { CommandLineBuffer } from "../model/command-line.buffer";
import { SessionModel } from "../model/session-model";
import { TerminalInputWriter } from "./input-writer";

/**
 * Edits the shell's input line: the line-editor actions, selection handling
 * and the whole-line replacement that autocomplete, history and composer
 * use. Runs whatever it is asked to run through `runEditorAction`; who asks
 * is not its business (ARCHITECTURE.md 2.1).
 */
export class CommandLineEditor implements ITerminalHandler {
  private _terminal?: Terminal;
  private _onSelectionChange?: IDisposable;
  private readonly WORD_SEPARATORS = "()[]{}'\"\\,;:/&<>*+=$^!~` ";
  private _selectionStart: number | null = null;

  constructor(
    private readonly _clipboard: ClipboardAccess,
    _pty: IPty,
    private readonly model: SessionModel,
    private readonly lineEditor?: ShellLineEditorDefinitionContract,
    private readonly commandLineBuffer: CommandLineBuffer = new CommandLineBuffer(
      new PromptMarkerRegistry(),
    ),
    private readonly inputWriter: TerminalInputWriter = new TerminalInputWriter(
      _pty,
      model,
      lineEditor,
    ),
  ) {}

  dispose(): void {
    this._onSelectionChange?.dispose();
    this._onSelectionChange = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.commandLineBuffer.setTerminal(terminal);

    this._onSelectionChange = terminal.onSelectionChange(() => {
      if (!this.commandLineBuffer.hasSelection()) {
        this._selectionStart = null;
      }
    });

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== "keydown") return true;
      if (event.key === "Enter" && event.shiftKey) {
        if (this.model.isCommandRunning) {
          // A program is reading stdin (REPL, heredoc prompt): a raw newline
          // is the only sensible meaning here.
          this._ptyWrite(String.fromCharCode(10));
        } else {
          // At the prompt, multiline input is edited in the composer overlay
          // instead of fighting the shell's single-line editing model.
          const input = this.model.input;
          const cursor = Math.max(0, Math.min(input.cursorIndex, input.text.length));
          // An empty prompt has no line to split — inserting "\n" there would
          // seed the composer with two blank lines instead of one. Just place
          // the cursor at the end of what's already there.
          const hasText = input.text.length > 0;
          this.model.report({
            type: "composerRequested",
            seedText: hasText ? `${input.text.slice(0, cursor)}\n${input.text.slice(cursor)}` : "",
            cursorIndex: hasText ? cursor + 1 : 0,
          });
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      if (this.model.isCommandRunning) return true;
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        this.commandLineBuffer.hasSelection()
      ) {
        return !this.deleteSelection();
      }
      if (this.shouldReplaceSelectionWithTypedText(event)) {
        return !this.replaceSelectionWithText(event.key, event);
      }
      if (
        (event.key === "ArrowUp" || event.key === "ArrowDown") &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        return this.handleVerticalArrow(event);
      }
      return true;
    });

    return this;
  }

  private readonly editorActions: Partial<Record<ShellLineEditorActionContract, () => void>> = {
    clearLine: () => this.clearCurrentInput(),
    clearLineToEnd: () => this.clearLineToEnd(),
    clearLineToStart: () => this.clearLineToStart(),
    deletePreviousWord: () => this.deletePreviousWord(),
    deleteNextWord: () => this.deleteNextWord(),
    goToNextWord: () => this.goToNextWord(),
    goToPreviousWord: () => this.goToPreviousWord(),
    goToStartOfLine: () => this.goToStartOfLine(),
    goToEndOfLine: () => this.goToEndOfLine(),
    selectAll: () => this.selectAll(),
    selectTextRight: () => this.selectTextRight(),
    selectTextLeft: () => this.selectTextLeft(),
    selectWordRight: () => this.selectWordRight(),
    selectWordLeft: () => this.selectWordLeft(),
    selectTextToEndOfLine: () => this.selectTextToEndOfLine(),
    selectTextToStartOfLine: () => this.selectTextToStartOfLine(),
  };

  /**
   * Runs a line-editor action at the prompt - natively through the shell
   * integration when the session reported it, otherwise by emulating it.
   * Nothing happens while a command runs: the line is not ours then.
   */
  runEditorAction(actionId: ShellLineEditorActionContract): void {
    const run = this.editorActions[actionId];
    if (!run || this.model.isCommandRunning) return;

    // Reset selection start for non-selection actions
    if (!actionId.startsWith("select")) {
      this._selectionStart = null;
    }

    if (this.executeNativeAction(actionId)) {
      return;
    }

    run();
  }

  /** Cuts the selected part of the input line to the clipboard. */
  cut(): void {
    if (this.model.isCommandRunning) return;
    this._selectionStart = null;
    this.cutSelection();
  }

  /** Replaces the whole input line, e.g. with a picked suggestion. */
  replaceInput(inputText: string, cursorIndex: number, autoExecute?: boolean): void {
    if (this.model.isCommandRunning) return;
    this._selectionStart = null;
    if (!this._terminal) return;
    this.inputWriter.replaceInput(inputText, cursorIndex, autoExecute);
  }

  private executeNativeAction(actionId: ShellLineEditorActionContract): boolean {
    if (this.supportsNativeShellAction(actionId)) {
      this.inputWriter.executeNativeAction(actionId);
      return true;
    }

    const nativeInput = this.lineEditor?.nativeInputByAction?.[actionId];
    if (!nativeInput) {
      return false;
    }

    this._ptyWrite(nativeInput);
    return true;
  }

  private supportsNativeShellAction(actionId: ShellLineEditorActionContract): boolean {
    return this.inputWriter.isNativeActionAvailable(actionId);
  }

  /**
   * Deletions shorten the real input, so the ghost-text bound (see
   * CommandLineObserver.shrinkMaxCursorIndexOnDelete) must shrink along —
   * but only by amounts that are provably real input, i.e. at or before the
   * cursor. Forward word-deletes stay out: their count is measured on the
   * inferred text, which may include ghost characters, and shrinking too far
   * would cut real input off the inference.
   */
  private shrinkMaxCursorIndexTo(upperBound: number): void {
    const input = this.model.input;
    if (upperBound >= input.maxCursorIndex) return;
    this.model.updateInput({ ...input, maxCursorIndex: Math.max(0, upperBound) });
  }

  clearCurrentInput() {
    if (!this._terminal) return;
    const input = this.model.input;
    const text = input.text;
    const countToEnd = text.length - input.cursorIndex;
    this.inputWriter.deleteChars(countToEnd, text.length);
    this.shrinkMaxCursorIndexTo(0);
  }

  clearLineToEnd() {
    const input = this.model.input;
    const countToEnd = input.text.length - input.cursorIndex;
    if (countToEnd > 0) {
      this.inputWriter.deleteChars(countToEnd, countToEnd);
      this.shrinkMaxCursorIndexTo(input.cursorIndex);
    }
  }

  clearLineToStart() {
    const input = this.model.input;
    const countToStart = input.cursorIndex;
    if (countToStart > 0) {
      this.inputWriter.deleteChars(0, countToStart);
      this.shrinkMaxCursorIndexTo(input.maxCursorIndex - countToStart);
    }
  }

  deletePreviousWord() {
    const input = this.model.input;
    const currentPos = input.cursorIndex;
    if (currentPos === 0) return;

    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToDelete = currentPos - prevWordStart;

    if (countToDelete > 0) {
      this.inputWriter.deleteChars(0, countToDelete);
      this.shrinkMaxCursorIndexTo(input.maxCursorIndex - countToDelete);
    }
  }

  deleteNextWord() {
    const input = this.model.input;
    const currentPos = input.cursorIndex;
    const text = input.text;
    if (currentPos >= text.length) return;

    const nextWordEnd = this.findNextWordEnd(text, currentPos);
    const countToDelete = nextWordEnd - currentPos;

    this.inputWriter.deleteChars(countToDelete, countToDelete);
  }

  goToNextWord() {
    const input = this.model.input;
    const currentPos = input.cursorIndex;
    const text = input.text;
    if (currentPos >= text.length) return;

    const nextWordEnd = this.findNextWordEnd(text, currentPos);
    const countToMove = nextWordEnd - currentPos;

    this.inputWriter.moveCursor(countToMove);
  }

  goToPreviousWord() {
    const input = this.model.input;
    const currentPos = input.cursorIndex;
    if (currentPos === 0) return;

    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToMove = currentPos - prevWordStart;

    this.inputWriter.moveCursor(-countToMove);
  }

  goToStartOfLine() {
    const input = this.model.input;
    if (input.cursorIndex === 0) return;

    this.inputWriter.moveCursor(-input.cursorIndex);
  }

  goToEndOfLine() {
    const input = this.model.input;
    const countToMove = input.text.length - input.cursorIndex;
    if (countToMove <= 0) return;

    this.inputWriter.moveCursor(countToMove);
  }

  selectTextRight() {
    this._selectAndMove(1);
  }

  selectTextLeft() {
    this._selectAndMove(-1);
  }

  selectWordRight() {
    const input = this.model.input;
    const currentPos = input.cursorIndex;
    const nextWordEnd = this.findNextWordEnd(input.text, currentPos);
    const countToMove = nextWordEnd - currentPos;
    if (countToMove > 0) {
      this._selectAndMove(countToMove);
    }
  }

  selectWordLeft() {
    const input = this.model.input;
    const currentPos = input.cursorIndex;
    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToMove = currentPos - prevWordStart;
    if (countToMove > 0) {
      this._selectAndMove(-countToMove);
    }
  }

  selectTextToEndOfLine() {
    const input = this.model.input;
    const countToMove = input.text.length - input.cursorIndex;
    if (countToMove > 0) {
      this._selectAndMove(countToMove);
    }
  }

  selectTextToStartOfLine() {
    const input = this.model.input;
    const countToMove = input.cursorIndex;
    if (countToMove > 0) {
      this._selectAndMove(-countToMove);
    }
  }

  private selectAll() {
    this._clearSelection();
    this._selectionStart = 0;
    const input = this.model.input;
    const currentCursorIdx = input.cursorIndex;
    const textLength = input.text.length;

    const offsetToEnd = textLength - currentCursorIdx;
    this.inputWriter.moveCursor(offsetToEnd);

    this.commandLineBuffer.selectInputSpan(0, textLength);
  }

  private _selectAndMove(offset: number) {
    this.select(offset);
    this.inputWriter.moveCursor(offset);
  }

  private _ptyWrite(data: string) {
    if (!this._terminal) return;
    this.inputWriter.writeRaw(data);
  }

  private handleVerticalArrow(event: KeyboardEvent): boolean {
    if (!this._terminal) return true;

    const input = this.model.input;
    const cols = this.commandLineBuffer.cols;
    const row = Math.floor(input.cursorIndex / cols);
    const lastRow = Math.floor(input.maxCursorIndex / cols);
    const direction = event.key === "ArrowUp" ? -1 : 1;

    if (direction === -1 && row === 0) {
      this.model.report({ type: "commandHistoryRequested" });
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    if (direction === 1 && row === lastRow) {
      return true;
    }

    const newIndex =
      direction === -1
        ? Math.max(0, input.cursorIndex - cols)
        : Math.min(input.maxCursorIndex, input.cursorIndex + cols);
    const offset = newIndex - input.cursorIndex;
    if (offset !== 0) {
      this._clearSelection();
      this.inputWriter.moveCursor(offset);
      // Optimistically reflect the move locally: the authoritative onCursorMove
      // event lags behind the pty round-trip, so without this a fast key-repeat
      // would read a stale cursorIndex and miscompute the next row boundary.
      this.model.updateInput({
        ...input,
        cursorIndex: newIndex,
        maxCursorIndex: Math.max(input.maxCursorIndex, newIndex),
      });
    }

    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  private cutSelection() {
    if (!this.commandLineBuffer.hasSelection()) return;

    const selectionText = this.commandLineBuffer.sanitizeCopiedText(
      this.commandLineBuffer.getSelection(),
    );
    if (selectionText) {
      this._clipboard.writeText(selectionText);
    }
    this.deleteSelection();
  }

  private replaceSelectionWithText(text: string, event: KeyboardEvent): boolean {
    if (this.replaceSelectedRange(text)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    if (!this.deleteSelection()) {
      return false;
    }

    this._ptyWrite(text);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  private deleteSelection(): boolean {
    const range = this.commandLineBuffer.selectedInputRange(this.model.input.maxCursorIndex);
    if (!range) {
      return false;
    }

    const deleteLength = range.endIndex - range.startIndex;
    if (deleteLength <= 0) {
      this._clearSelection();
      return true;
    }

    if (this.replaceSelectedRange("")) {
      return true;
    }

    if (this.supportsNativeShellAction("deleteSelection")) {
      this.inputWriter.executeNativeAction("deleteSelection", {
        start: range.startIndex,
        length: deleteLength,
      });
      this._clearSelection();
      return true;
    }

    const input = this.model.input;
    const currentCursorIdx = input.cursorIndex;
    const cursorOffsetToEnd = range.endIndex - currentCursorIdx;

    this.inputWriter.deleteChars(cursorOffsetToEnd, deleteLength);
    this._clearSelection();
    return true;
  }

  private _clearSelection() {
    this._selectionStart = null;
    this.commandLineBuffer.clearSelection();
  }

  private shouldReplaceSelectionWithTypedText(event: KeyboardEvent): boolean {
    return Boolean(
      this.commandLineBuffer.hasSelection() &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey,
    );
  }

  private replaceSelectedRange(replacementText: string): boolean {
    if (!this.supportsNativeShellAction("replaceCurrentInput")) {
      return false;
    }

    const range = this.commandLineBuffer.selectedInputRange(this.model.input.maxCursorIndex);
    if (!range) {
      return false;
    }

    const input = this.model.input;
    const nextText =
      input.text.slice(0, range.startIndex) + replacementText + input.text.slice(range.endIndex);
    const nextCursorIndex = range.startIndex + replacementText.length;

    this.inputWriter.executeNativeAction("replaceCurrentInput", {
      text: nextText,
      cursorIndex: nextCursorIndex,
    });
    this._clearSelection();
    return true;
  }

  private select(count: number) {
    if (!this._terminal) return;

    const input = this.model.input;
    const currentPos = input.cursorIndex;

    if (this._selectionStart === null) {
      const range = this.commandLineBuffer.selectedInputRange(input.maxCursorIndex);
      if (range) {
        if (Math.abs(currentPos - range.endIndex) < Math.abs(currentPos - range.startIndex)) {
          this._selectionStart = range.startIndex;
        } else {
          this._selectionStart = range.endIndex;
        }
      } else {
        this._selectionStart = currentPos;
      }
    }

    const newPos = Math.max(0, Math.min(input.text.length, currentPos + count));
    const start = Math.min(this._selectionStart, newPos);
    const length = Math.abs(newPos - this._selectionStart);

    this.commandLineBuffer.selectInputSpan(start, length);
  }

  private findPreviousWordStart(text: string, currentPos: number): number {
    let pos = currentPos - 1;
    while (pos >= 0 && this.WORD_SEPARATORS.includes(text[pos])) {
      pos--;
    }
    while (pos >= 0 && !this.WORD_SEPARATORS.includes(text[pos])) {
      pos--;
    }
    return pos + 1;
  }

  private findNextWordEnd(text: string, currentPos: number): number {
    let pos = currentPos;
    while (pos < text.length && this.WORD_SEPARATORS.includes(text[pos])) {
      pos++;
    }
    while (pos < text.length && !this.WORD_SEPARATORS.includes(text[pos])) {
      pos++;
    }
    return pos;
  }
}
