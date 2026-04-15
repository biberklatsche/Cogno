import { Clipboard } from "@cogno/app-tauri/clipboard";
import { ShellLineEditorDefinitionContract } from "@cogno/core-api";
import { IDisposable as IXtermDisposable, Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { Char } from "../../../common/chars/chars";
import { IDisposable } from "../../../common/models/models";
import { TerminalId } from "../../../grid-list/+model/model";
import { IPty } from "../pty/pty";
import { TerminalStateManager } from "../state";
import { ITerminalHandler } from "./handler";

export class InputHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private subscription: Subscription = new Subscription();
  private terminalInputDisposable?: IXtermDisposable;

  constructor(
    private _bus: AppBus,
    private _terminalId: TerminalId,
    private stateManager: TerminalStateManager,
    private pty: IPty,
    private readonly lineEditor?: ShellLineEditorDefinitionContract,
  ) {}

  dispose(): void {
    this.terminalInputDisposable?.dispose();
    this.terminalInputDisposable = undefined;
    if (!this.subscription) return;
    this.subscription.unsubscribe();
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.subscription.add(
      this._bus.on$({ path: ["app", "terminal"], type: "ClearBuffer" }).subscribe((event) => {
        if (event.payload !== this._terminalId) return;
        this._terminal?.clear();
      }),
    );
    this.subscription.add(
      this._bus.on$({ path: ["app", "terminal"], type: "Paste" }).subscribe(async (event) => {
        if (event.payload !== this._terminalId) return;
        await this.pasteClipboardText();
      }),
    );
    this.subscription.add(
      this._bus
        .on$({ path: ["app", "terminal"], type: "InjectTerminalInput" })
        .subscribe((event) => {
          if (event.payload?.terminalId !== this._terminalId) return;
          this.pty.write(event.payload.text);
          if (event.payload.appendNewline) {
            this.scheduleCommandExecution();
          }
        }),
    );
    this.terminalInputDisposable = terminal.onData(() => {
      this.stateManager.clearUnreadNotification();
    });
    return this;
  }

  private async pasteClipboardText(): Promise<void> {
    if (!this._terminal) return;
    const clipboardText = await Clipboard.readText();
    if (this.stateManager.isCommandRunning || !this.replaceSelectedInput(clipboardText)) {
      this._terminal.paste(clipboardText);
    }
  }

  private replaceSelectedInput(replacementText: string): boolean {
    if (!this._terminal?.hasSelection()) return false;

    const selectionRange = this.getSelectedInputRange();
    if (!selectionRange) {
      return false;
    }

    const deleteLength = selectionRange.endIndex - selectionRange.startIndex;
    if (deleteLength <= 0) {
      return false;
    }

    const input = this.stateManager.input;
    if (this.lineEditor?.nativeActionsViaShellIntegration?.includes("replaceCurrentInput")) {
      const nextText =
        input.text.slice(0, selectionRange.startIndex) +
        replacementText +
        input.text.slice(selectionRange.endIndex);
      this.pty.executeShellAction("replaceCurrentInput", {
        text: nextText,
        cursorIndex: selectionRange.startIndex + replacementText.length,
      });
      this._terminal.clearSelection();
      return true;
    }

    const endIndex = selectionRange.endIndex;
    const cursorOffsetToSelectionEnd = endIndex - input.cursorIndex;
    this.pty.write(
      this.buildCursorMoveCommand(cursorOffsetToSelectionEnd) + Char.Backspace.repeat(deleteLength),
    );
    this._terminal.clearSelection();
    this.pty.write(replacementText);
    return true;
  }

  private buildCursorMoveCommand(offset: number): string {
    if (offset === 0) return "";
    const direction = offset > 0 ? "\x1b[C" : "\x1b[D";
    return direction.repeat(Math.abs(offset));
  }

  private scheduleCommandExecution(): void {
    queueMicrotask(() => {
      this.pty.write(Char.Enter);
    });
  }

  private findLastCognoMarkerY(): number {
    if (!this._terminal?.buffer.active) return -1;
    for (let lineIndex = this._terminal.buffer.active.length - 1; lineIndex >= 0; lineIndex--) {
      const line = this._terminal.buffer.active.getLine(lineIndex);
      if (line?.translateToString().includes("^^#")) {
        return lineIndex;
      }
    }
    return -1;
  }

  private getSelectedInputRange(): { startIndex: number; endIndex: number } | undefined {
    if (!this._terminal) return undefined;

    const selection = this._terminal.getSelectionPosition();
    if (!selection) return undefined;

    const input = this.stateManager.input;
    const startInputY = this.findLastCognoMarkerY() + 1;
    const startIndex = (selection.start.y - startInputY) * this._terminal.cols + selection.start.x;
    const endIndex = (selection.end.y - startInputY) * this._terminal.cols + selection.end.x;

    if (startIndex < 0 || endIndex > input.maxCursorIndex) {
      return undefined;
    }

    return { startIndex, endIndex };
  }
}
