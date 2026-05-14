import { Clipboard } from "@cogno/app-tauri/clipboard";
import { ShellLineEditorActionContract, ShellLineEditorDefinitionContract } from "@cogno/core-api";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus } from "../../../../app-bus/app-bus";
import { AppMessage } from "../../../../app-bus/messages";
import { IDisposable } from "../../../../common/models/models";
import { ITerminalHandler } from "../../handler/handler";
import { isPromptMarkerLine, sanitizePromptMarkerText } from "../../prompt-marker";
import { IPty } from "../../pty/pty";
import { TerminalStateManager } from "../../state";

export class CommandLineEditor implements ITerminalHandler {
  private _terminal?: Terminal;
  private subscription: Subscription = new Subscription();
  private _onSelectionChange?: IDisposable;
  private readonly WORD_SEPARATORS = "()[]{}'\"\\,;:/&<>*+=$^!~` ";
  private _selectionStart: number | null = null;

  constructor(
    private _bus: AppBus,
    private _pty: IPty,
    private stateManager: TerminalStateManager,
    private readonly lineEditor?: ShellLineEditorDefinitionContract,
  ) {}

  dispose(): void {
    this.subscription.unsubscribe();
    this._onSelectionChange?.dispose();
    this._onSelectionChange = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;

    this._onSelectionChange = terminal.onSelectionChange(() => {
      if (this._terminal && !this._terminal.hasSelection()) {
        this._selectionStart = null;
      }
    });

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== "keydown") return true;
      if (event.key === "Enter" && event.shiftKey) {
        this._ptyWrite(String.fromCharCode(10));
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      if (this.stateManager.isCommandRunning) return true;
      if ((event.key === "Backspace" || event.key === "Delete") && this._terminal?.hasSelection()) {
        return !this.deleteSelection();
      }
      if (this.shouldReplaceSelectionWithTypedText(event)) {
        return !this.replaceSelectionWithText(event.key, event);
      }
      return true;
    });

    const actions: Record<string, { actionId: ShellLineEditorActionContract; run: () => void }> = {
      ClearLine: { actionId: "clearLine", run: () => this.clearCurrentInput() },
      ClearLineToEnd: { actionId: "clearLineToEnd", run: () => this.clearLineToEnd() },
      ClearLineToStart: { actionId: "clearLineToStart", run: () => this.clearLineToStart() },
      DeletePreviousWord: { actionId: "deletePreviousWord", run: () => this.deletePreviousWord() },
      DeleteNextWord: { actionId: "deleteNextWord", run: () => this.deleteNextWord() },
      GoToNextWord: { actionId: "goToNextWord", run: () => this.goToNextWord() },
      GoToPreviousWord: { actionId: "goToPreviousWord", run: () => this.goToPreviousWord() },
      GoToStartOfLine: { actionId: "goToStartOfLine", run: () => this.goToStartOfLine() },
      GoToEndOfLine: { actionId: "goToEndOfLine", run: () => this.goToEndOfLine() },
      SelectAll: { actionId: "selectAll", run: () => this.selectAll() },
      SelectTextRight: { actionId: "selectTextRight", run: () => this.selectTextRight() },
      SelectTextLeft: { actionId: "selectTextLeft", run: () => this.selectTextLeft() },
      SelectWordRight: { actionId: "selectWordRight", run: () => this.selectWordRight() },
      SelectWordLeft: { actionId: "selectWordLeft", run: () => this.selectWordLeft() },
      SelectTextToEndOfLine: {
        actionId: "selectTextToEndOfLine",
        run: () => this.selectTextToEndOfLine(),
      },
      SelectTextToStartOfLine: {
        actionId: "selectTextToStartOfLine",
        run: () => this.selectTextToStartOfLine(),
      },
    };

    Object.entries(actions).forEach(([key, handler]) => {
      const type = key as AppMessage["type"];
      this.subscription.add(
        this._bus.on$({ path: ["app", "terminal"], type }).subscribe(async (event) => {
          const payloadTerminalId =
            typeof event.payload === "string"
              ? event.payload
              : typeof event.payload === "object" &&
                  event.payload !== null &&
                  "terminalId" in event.payload
                ? String(event.payload.terminalId)
                : undefined;
          if (
            payloadTerminalId !== this.stateManager.terminalId ||
            this.stateManager.isCommandRunning
          )
            return;

          // Reset selection start for non-selection actions
          if (!type.startsWith("Select")) {
            this._selectionStart = null;
          }

          if (this.executeNativeAction(handler.actionId)) {
            return;
          }

          handler.run();
        }),
      );
    });

    this.subscription.add(
      this._bus.on$({ path: ["app", "terminal"], type: "Cut" }).subscribe((event) => {
        if (event.payload !== this.stateManager.terminalId || this.stateManager.isCommandRunning)
          return;
        this._selectionStart = null;
        this.cutSelection();
      }),
    );
    this.subscription.add(
      this._bus
        .on$({ path: ["app", "terminal"], type: "ApplyAutocompleteSuggestion" })
        .subscribe((event) => {
          const payload = event.payload;
          if (
            !payload ||
            payload.terminalId !== this.stateManager.terminalId ||
            this.stateManager.isCommandRunning
          )
            return;
          this._selectionStart = null;
          this.applyAutocompleteSuggestion(payload.inputText, payload.cursorIndex);
        }),
    );

    return this;
  }

  private executeNativeAction(actionId: ShellLineEditorActionContract): boolean {
    if (this.lineEditor?.nativeActionsViaShellIntegration?.includes(actionId)) {
      this._pty.executeShellAction(actionId);
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
    return this.lineEditor?.nativeActionsViaShellIntegration?.includes(actionId) ?? false;
  }

  clearCurrentInput() {
    if (!this._terminal) return;
    const input = this.stateManager.input;
    const text = input.text;
    const countToEnd = text.length - input.cursorIndex;
    this._ptyWrite(
      this._buildCursorMoveCommand(countToEnd) + String.fromCharCode(8).repeat(text.length),
    );
  }

  clearLineToEnd() {
    const input = this.stateManager.input;
    const countToEnd = input.text.length - input.cursorIndex;
    if (countToEnd > 0) {
      this._ptyWrite(
        this._buildCursorMoveCommand(countToEnd) + String.fromCharCode(8).repeat(countToEnd),
      );
    }
  }

  clearLineToStart() {
    const input = this.stateManager.input;
    const countToStart = input.cursorIndex;
    if (countToStart > 0) {
      this._ptyWrite(String.fromCharCode(8).repeat(countToStart));
    }
  }

  deletePreviousWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    if (currentPos === 0) return;

    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToDelete = currentPos - prevWordStart;

    if (countToDelete > 0) {
      this._ptyWrite(String.fromCharCode(8).repeat(countToDelete));
    }
  }

  deleteNextWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    const text = input.text;
    if (currentPos >= text.length) return;

    const nextWordEnd = this.findNextWordEnd(text, currentPos);
    const countToDelete = nextWordEnd - currentPos;

    if (countToDelete > 0) {
      this._ptyWrite(
        this._buildCursorMoveCommand(countToDelete) + String.fromCharCode(8).repeat(countToDelete),
      );
    }
  }

  goToNextWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    const text = input.text;
    if (currentPos >= text.length) return;

    const nextWordEnd = this.findNextWordEnd(text, currentPos);
    const countToMove = nextWordEnd - currentPos;

    if (countToMove > 0) {
      this._ptyWrite(this._buildCursorMoveCommand(countToMove));
    }
  }

  goToPreviousWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    if (currentPos === 0) return;

    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToMove = currentPos - prevWordStart;

    if (countToMove > 0) {
      this._ptyWrite(this._buildCursorMoveCommand(-countToMove));
    }
  }

  goToStartOfLine() {
    const input = this.stateManager.input;
    if (input.cursorIndex === 0) return;

    this._ptyWrite(this._buildCursorMoveCommand(-input.cursorIndex));
  }

  goToEndOfLine() {
    const input = this.stateManager.input;
    const countToMove = input.text.length - input.cursorIndex;
    if (countToMove <= 0) return;

    this._ptyWrite(this._buildCursorMoveCommand(countToMove));
  }

  selectTextRight() {
    this._selectAndMove(1);
  }

  selectTextLeft() {
    this._selectAndMove(-1);
  }

  selectWordRight() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    const nextWordEnd = this.findNextWordEnd(input.text, currentPos);
    const countToMove = nextWordEnd - currentPos;
    if (countToMove > 0) {
      this._selectAndMove(countToMove);
    }
  }

  selectWordLeft() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToMove = currentPos - prevWordStart;
    if (countToMove > 0) {
      this._selectAndMove(-countToMove);
    }
  }

  selectTextToEndOfLine() {
    const input = this.stateManager.input;
    const countToMove = input.text.length - input.cursorIndex;
    if (countToMove > 0) {
      this._selectAndMove(countToMove);
    }
  }

  selectTextToStartOfLine() {
    const input = this.stateManager.input;
    const countToMove = input.cursorIndex;
    if (countToMove > 0) {
      this._selectAndMove(-countToMove);
    }
  }

  private selectAll() {
    this._clearSelection();
    this._selectionStart = 0;
    const input = this.stateManager.input;
    const currentCursorIdx = input.cursorIndex;
    const textLength = input.text.length;

    const offsetToEnd = textLength - currentCursorIdx;
    this._ptyWrite(this._buildCursorMoveCommand(offsetToEnd));

    this.selectAbsolute(0, textLength);
  }

  private selectAbsolute(start: number, end: number) {
    if (!this._terminal) return;
    const length = Math.abs(end - start);
    const actualStart = Math.min(start, end);

    const startInputY = this.findLastCognoMarkerY() + 1;
    const startCol = actualStart % this._terminal.cols;
    const startRow = startInputY + Math.floor(actualStart / this._terminal.cols);

    this._terminal.select(startCol, startRow, length);
  }

  private _selectAndMove(offset: number) {
    this.select(offset);
    this._ptyWrite(this._buildCursorMoveCommand(offset));
  }

  private _ptyWrite(data: string) {
    if (!this._terminal) return;
    this._pty.write(data);
  }

  private applyAutocompleteSuggestion(inputText: string, cursorIndex: number) {
    if (!this._terminal) return;
    if (this.supportsNativeShellAction("replaceCurrentInput")) {
      this._pty.executeShellAction("replaceCurrentInput", {
        text: inputText,
        cursorIndex,
      });
      return;
    }

    const input = this.stateManager.input;
    const countToEnd = input.text.length - input.cursorIndex;
    const clearCmd =
      this._buildCursorMoveCommand(countToEnd) + String.fromCharCode(8).repeat(input.text.length);
    this._ptyWrite(clearCmd);
    this._ptyWrite(inputText);

    const leftToTarget = inputText.length - Math.max(0, Math.min(cursorIndex, inputText.length));
    if (leftToTarget > 0) {
      this._ptyWrite(this._buildCursorMoveCommand(-leftToTarget));
    }
  }

  private cutSelection() {
    if (!this._terminal?.hasSelection()) return;

    const selectionText = sanitizePromptMarkerText(this._terminal.getSelection());
    if (selectionText) {
      Clipboard.writeText(selectionText);
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
    const range = this.getSelectedInputRange();
    if (!range) {
      return false;
    }

    const deleteLength = range.endIdx - range.startIdx;
    if (deleteLength <= 0) {
      this._clearSelection();
      return true;
    }

    if (this.replaceSelectedRange("")) {
      return true;
    }

    if (this.supportsNativeShellAction("deleteSelection")) {
      this._pty.executeShellAction("deleteSelection", {
        start: range.startIdx,
        length: deleteLength,
      });
      this._clearSelection();
      return true;
    }

    const input = this.stateManager.input;
    const currentCursorIdx = input.cursorIndex;
    const cursorOffsetToEnd = range.endIdx - currentCursorIdx;

    this._ptyWrite(
      this._buildCursorMoveCommand(cursorOffsetToEnd) + String.fromCharCode(8).repeat(deleteLength),
    );
    this._clearSelection();
    return true;
  }

  private _buildCursorMoveCommand(offset: number): string {
    if (offset === 0) {
      return "";
    }

    const escapeCode = String.fromCharCode(27);
    const direction = offset > 0 ? "C" : "D";
    const count = Math.abs(offset);

    return `${escapeCode}[${direction}`.repeat(count);
  }

  private _clearSelection() {
    this._selectionStart = null;
    this._terminal?.clearSelection();
  }

  private shouldReplaceSelectionWithTypedText(event: KeyboardEvent): boolean {
    return Boolean(
      this._terminal?.hasSelection() &&
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

    const range = this.getSelectedInputRange();
    if (!range) {
      return false;
    }

    const input = this.stateManager.input;
    const nextText =
      input.text.slice(0, range.startIdx) + replacementText + input.text.slice(range.endIdx);
    const nextCursorIndex = range.startIdx + replacementText.length;

    this._pty.executeShellAction("replaceCurrentInput", {
      text: nextText,
      cursorIndex: nextCursorIndex,
    });
    this._clearSelection();
    return true;
  }

  private getSelectedInputRange(): { startIdx: number; endIdx: number } | undefined {
    if (!this._terminal) {
      return undefined;
    }

    const selection = this._terminal.getSelectionPosition();
    if (!selection) {
      return undefined;
    }

    const lastCognoY = this.findLastCognoMarkerY();
    const startInputY = lastCognoY + 1;
    const cols = this._terminal.cols;

    const startIdx = (selection.start.y - startInputY) * cols + selection.start.x;
    const endIdx = (selection.end.y - startInputY) * cols + selection.end.x;

    const input = this.stateManager.input;
    if (startIdx < 0 || endIdx > input.maxCursorIndex) {
      return undefined;
    }

    return { startIdx, endIdx };
  }

  private select(count: number) {
    if (!this._terminal) return;
    if (!this._terminal.buffer.active) return;

    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;

    if (this._selectionStart === null) {
      const selection = this._terminal.getSelectionPosition();
      if (selection) {
        const lastCognoY = this.findLastCognoMarkerY();
        const startInputY = lastCognoY + 1;
        const cols = this._terminal.cols;
        const startIdx = (selection.start.y - startInputY) * cols + selection.start.x;
        const endIdx = (selection.end.y - startInputY) * cols + selection.end.x;
        if (Math.abs(currentPos - endIdx) < Math.abs(currentPos - startIdx)) {
          this._selectionStart = startIdx;
        } else {
          this._selectionStart = endIdx;
        }
      } else {
        this._selectionStart = currentPos;
      }
    }

    const newPos = Math.max(0, Math.min(input.text.length, currentPos + count));
    const start = Math.min(this._selectionStart, newPos);
    const length = Math.abs(newPos - this._selectionStart);

    const startInputY = this.findLastCognoMarkerY() + 1;
    const startCol = start % this._terminal.cols;
    const startRow = startInputY + Math.floor(start / this._terminal.cols);

    this._terminal.select(startCol, startRow, length);
  }

  private findLastCognoMarkerY(): number {
    let lastPromptRow = -1;
    if (!this._terminal?.buffer?.active) return lastPromptRow;
    for (let i = this._terminal.buffer.active.length - 1; i >= 0; i--) {
      const line = this._terminal.buffer.active.getLine(i);
      if (line && isPromptMarkerLine(line.translateToString())) {
        lastPromptRow = i;
        break;
      }
    }
    return lastPromptRow;
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
