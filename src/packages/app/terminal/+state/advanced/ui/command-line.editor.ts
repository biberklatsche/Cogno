import { Clipboard } from "@cogno/app-tauri/clipboard";
import { ShellLineEditorActionContract, ShellLineEditorDefinitionContract } from "@cogno/core-api";
import { IDisposable } from "@cogno/core-support";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { ActionFired } from "../../../../action/action.models";
import { AppBus } from "../../../../app-bus/app-bus";
import { AppMessage } from "../../../../app-bus/messages";
import { ITerminalHandler } from "../../handler/handler";
import { TerminalInputWriter } from "../../input-writer";
import { IPty } from "../../pty/pty";
import { TerminalStateManager } from "../../state";
import { CommandLineBuffer } from "./command-line.buffer";
import { PromptMarkerRegistry } from "./prompt-marker.registry";

export class CommandLineEditor implements ITerminalHandler {
  private _terminal?: Terminal;
  private subscription: Subscription = new Subscription();
  private _onSelectionChange?: IDisposable;
  private readonly WORD_SEPARATORS = "()[]{}'\"\\,;:/&<>*+=$^!~` ";
  private _selectionStart: number | null = null;

  constructor(
    private _bus: AppBus,
    _pty: IPty,
    private stateManager: TerminalStateManager,
    private readonly lineEditor?: ShellLineEditorDefinitionContract,
    private readonly commandLineBuffer: CommandLineBuffer = new CommandLineBuffer(
      new PromptMarkerRegistry(),
    ),
    private readonly inputWriter: TerminalInputWriter = new TerminalInputWriter(
      _pty,
      stateManager,
      lineEditor,
    ),
  ) {}

  dispose(): void {
    this.subscription.unsubscribe();
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
        if (this.stateManager.isCommandRunning) {
          // A program is reading stdin (REPL, heredoc prompt): a raw newline
          // is the only sensible meaning here.
          this._ptyWrite(String.fromCharCode(10));
        } else {
          // At the prompt, multiline input is edited in the composer overlay
          // instead of fighting the shell's single-line editing model.
          const input = this.stateManager.input;
          const cursor = Math.max(0, Math.min(input.cursorIndex, input.text.length));
          // An empty prompt has no line to split — inserting "\n" there would
          // seed the composer with two blank lines instead of one. Just place
          // the cursor at the end of what's already there.
          const hasText = input.text.length > 0;
          this._bus.publish({
            path: ["app", "terminal"],
            type: "OpenComposer",
            payload: {
              terminalId: this.stateManager.terminalId,
              seedText: hasText
                ? `${input.text.slice(0, cursor)}\n${input.text.slice(cursor)}`
                : "",
              cursorIndex: hasText ? cursor + 1 : 0,
            },
          });
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      if (this.stateManager.isCommandRunning) return true;
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
        .on$({ path: ["app", "terminal"], type: "ReplaceTerminalInput" })
        .subscribe((event) => {
          const payload = event.payload;
          if (
            !payload ||
            payload.terminalId !== this.stateManager.terminalId ||
            this.stateManager.isCommandRunning
          )
            return;
          this._selectionStart = null;
          if (!this._terminal) return;
          this.inputWriter.replaceInput(
            payload.inputText,
            payload.cursorIndex,
            payload.autoExecute,
          );
        }),
    );

    return this;
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

  clearCurrentInput() {
    if (!this._terminal) return;
    const input = this.stateManager.input;
    const text = input.text;
    const countToEnd = text.length - input.cursorIndex;
    this.inputWriter.deleteChars(countToEnd, text.length);
  }

  clearLineToEnd() {
    const input = this.stateManager.input;
    const countToEnd = input.text.length - input.cursorIndex;
    this.inputWriter.deleteChars(countToEnd, countToEnd);
  }

  clearLineToStart() {
    const input = this.stateManager.input;
    const countToStart = input.cursorIndex;
    this.inputWriter.deleteChars(0, countToStart);
  }

  deletePreviousWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    if (currentPos === 0) return;

    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToDelete = currentPos - prevWordStart;

    this.inputWriter.deleteChars(0, countToDelete);
  }

  deleteNextWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    const text = input.text;
    if (currentPos >= text.length) return;

    const nextWordEnd = this.findNextWordEnd(text, currentPos);
    const countToDelete = nextWordEnd - currentPos;

    this.inputWriter.deleteChars(countToDelete, countToDelete);
  }

  goToNextWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    const text = input.text;
    if (currentPos >= text.length) return;

    const nextWordEnd = this.findNextWordEnd(text, currentPos);
    const countToMove = nextWordEnd - currentPos;

    this.inputWriter.moveCursor(countToMove);
  }

  goToPreviousWord() {
    const input = this.stateManager.input;
    const currentPos = input.cursorIndex;
    if (currentPos === 0) return;

    const prevWordStart = this.findPreviousWordStart(input.text, currentPos);
    const countToMove = currentPos - prevWordStart;

    this.inputWriter.moveCursor(-countToMove);
  }

  goToStartOfLine() {
    const input = this.stateManager.input;
    if (input.cursorIndex === 0) return;

    this.inputWriter.moveCursor(-input.cursorIndex);
  }

  goToEndOfLine() {
    const input = this.stateManager.input;
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

    const input = this.stateManager.input;
    const cols = this.commandLineBuffer.cols;
    const row = Math.floor(input.cursorIndex / cols);
    const lastRow = Math.floor(input.maxCursorIndex / cols);
    const direction = event.key === "ArrowUp" ? -1 : 1;

    if (direction === -1 && row === 0) {
      this._bus.publish(ActionFired.create("trigger_command_history"));
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
      this.stateManager.updateInput({
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
    const range = this.commandLineBuffer.selectedInputRange(this.stateManager.input.maxCursorIndex);
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

    const input = this.stateManager.input;
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

    const range = this.commandLineBuffer.selectedInputRange(this.stateManager.input.maxCursorIndex);
    if (!range) {
      return false;
    }

    const input = this.stateManager.input;
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

    const input = this.stateManager.input;
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
