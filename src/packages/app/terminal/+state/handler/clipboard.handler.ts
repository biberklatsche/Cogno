import { bytesToBase64, Clipboard } from "@cogno/app-tauri/clipboard";
import { ShellLineEditorDefinitionContract, TerminalId } from "@cogno/core-api";
import { IDisposable } from "@cogno/core-support";
import { Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { ConfigService } from "../../../config/+state/config.service";
import { CommandLineBuffer } from "../advanced/ui/command-line.buffer";
import { PromptMarkerRegistry } from "../advanced/ui/prompt-marker.registry";
import { TerminalInputWriter } from "../input-writer";
import { IPty } from "../pty/pty";
import { TerminalStateManager } from "../state";
import { ITerminalHandler } from "./handler";
import { SelectionHandler } from "./selection.handler";

function base64ToText(base64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

export class ClipboardHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private subscription: Subscription = new Subscription();

  constructor(
    private bus: AppBus,
    private terminalId: TerminalId,
    private stateManager: TerminalStateManager,
    private pty: IPty,
    private configService: ConfigService,
    private readonly selectionHandler: SelectionHandler,
    readonly lineEditor?: ShellLineEditorDefinitionContract,
    private readonly commandLineBuffer: CommandLineBuffer = new CommandLineBuffer(
      new PromptMarkerRegistry(),
    ),
    private readonly inputWriter: TerminalInputWriter = new TerminalInputWriter(
      pty,
      stateManager,
      lineEditor,
    ),
  ) {}

  dispose(): void {
    this.subscription.unsubscribe();
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.commandLineBuffer.setTerminal(terminal);

    const osc52Disposable = terminal.parser.registerOscHandler(52, (data) => {
      void this.handleOsc52(data);
      return true;
    });
    this.subscription.add(() => osc52Disposable.dispose());

    this.subscription.add(
      this.bus.on$({ path: ["app", "terminal"], type: "Paste" }).subscribe(async (event) => {
        if (event.payload !== this.terminalId) return;
        await this.pasteFromClipboard();
      }),
    );

    this.subscription.add(
      this.bus.on$({ path: ["app", "terminal"], type: "Copy" }).subscribe(async (event) => {
        if (event.payload !== this.terminalId || !this.selectionHandler.hasSelection()) return;
        await Clipboard.writeText(this.getSelectionText());
        if (this.configService.config.selection?.clear_on_copy) {
          this.selectionHandler.clearSelection();
        }
      }),
    );

    return this;
  }

  private getSelectionText(): string {
    const raw = this.commandLineBuffer.sanitizeCopiedText(this.selectionHandler.getSelection());
    const trimTrailing = this.configService.config.clipboard?.trim_trailing_spaces ?? true;
    if (!trimTrailing) return raw;
    return raw
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n");
  }

  private async pasteFromClipboard(): Promise<void> {
    if (!this._terminal) return;

    const ttlSeconds = this.configService.config.clipboard?.image_paste_ttl_seconds ?? 60;
    const filePath = await Clipboard.readImageFromClipboard(ttlSeconds * 1000);
    if (filePath !== null) {
      this.inputWriter.writeRaw(filePath.includes(" ") ? `"${filePath}"` : filePath);
      return;
    }

    let clipboardText: string;
    try {
      clipboardText = await Clipboard.readText();
    } catch {
      return;
    }

    if (this.stateManager.isCommandRunning) {
      this._terminal.paste(clipboardText);
      return;
    }
    if (this.replaceSelectedInput(clipboardText)) return;
    if (this.openComposerForMultilinePaste(clipboardText)) return;
    this._terminal.paste(clipboardText);
  }

  /**
   * Pasting multiline text at the prompt opens the composer seeded with the
   * current input plus the pasted text at the cursor: the user reviews and
   * edits it there instead of the shell receiving half-executed lines.
   */
  private openComposerForMultilinePaste(clipboardText: string): boolean {
    if (!/\r?\n/.test(clipboardText)) return false;
    const input = this.stateManager.input;
    const cursor = Math.max(0, Math.min(input.cursorIndex, input.text.length));
    const pasted = clipboardText.replace(/\r\n/g, "\n");
    this.bus.publish({
      path: ["app", "terminal"],
      type: "OpenComposer",
      payload: {
        terminalId: this.terminalId,
        seedText: input.text.slice(0, cursor) + pasted + input.text.slice(cursor),
        cursorIndex: cursor + pasted.length,
      },
    });
    return true;
  }

  private async handleOsc52(data: string): Promise<void> {
    const semicolonIndex = data.indexOf(";");
    if (semicolonIndex === -1) return;
    const pd = data.slice(semicolonIndex + 1);

    if (pd === "?") {
      await this.handleOsc52Read();
    } else {
      await this.handleOsc52Write(pd);
    }
  }

  private async handleOsc52Read(): Promise<void> {
    const allowed = (this.configService.config.clipboard?.read ?? "allow") === "allow";
    if (!allowed) {
      this.pty.write("\x1b]52;c;\x07");
      return;
    }
    try {
      const text = await Clipboard.readText();
      this.pty.write(`\x1b]52;c;${bytesToBase64(new TextEncoder().encode(text))}\x07`);
    } catch {
      this.pty.write("\x1b]52;c;\x07");
    }
  }

  private async handleOsc52Write(base64Data: string): Promise<void> {
    const allowed = (this.configService.config.clipboard?.write ?? "allow") === "allow";
    if (!allowed) return;
    try {
      await Clipboard.writeText(base64ToText(base64Data));
    } catch {
      // Silently ignore malformed base64
    }
  }

  private replaceSelectedInput(replacementText: string): boolean {
    if (!this.selectionHandler.hasSelection()) return false;

    const selectionRange = this.commandLineBuffer.selectedInputRange(
      this.stateManager.input.maxCursorIndex,
    );
    if (!selectionRange) return false;

    const deleteLength = selectionRange.endIndex - selectionRange.startIndex;
    if (deleteLength <= 0) return false;

    const input = this.stateManager.input;
    const nextText =
      input.text.slice(0, selectionRange.startIndex) +
      replacementText +
      input.text.slice(selectionRange.endIndex);
    this.selectionHandler.clearSelection();
    this.inputWriter.replaceInput(nextText, selectionRange.startIndex + replacementText.length);
    return true;
  }
}
