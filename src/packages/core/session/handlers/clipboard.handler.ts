import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { SelectionHandler } from "@cogno/core/terminal/handlers/selection.handler";
import { IPty } from "@cogno/core/terminal/pty";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { bytesToBase64, ClipboardAccess } from "@cogno/platform/clipboard";
import { ShellLineEditorDefinitionContract } from "@cogno/shared/contributions";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { PromptMarkerRegistry } from "../decoration/prompt-marker.registry";
import { TerminalInputWriter } from "../editor/input-writer";
import { CommandLineBuffer } from "../model/command-line.buffer";
import { SessionModel } from "../model/session-model";

function base64ToText(base64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/**
 * Copy, paste and OSC 52 for one session. `paste()` and `copy()` are asked
 * for; what they do with the input line is decided here.
 */
export class ClipboardHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private osc52Disposable?: IDisposable;

  constructor(
    private readonly _clipboard: ClipboardAccess,
    private readonly model: SessionModel,
    private pty: IPty,
    private configService: ConfigService,
    private readonly selectionHandler: SelectionHandler,
    readonly lineEditor?: ShellLineEditorDefinitionContract,
    private readonly commandLineBuffer: CommandLineBuffer = new CommandLineBuffer(
      new PromptMarkerRegistry(),
    ),
    private readonly inputWriter: TerminalInputWriter = new TerminalInputWriter(
      pty,
      model,
      lineEditor,
    ),
  ) {}

  dispose(): void {
    this.osc52Disposable?.dispose();
    this.osc52Disposable = undefined;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this.commandLineBuffer.setTerminal(terminal);
    this.osc52Disposable = terminal.parser.registerOscHandler(52, (data) => {
      void this.handleOsc52(data);
      return true;
    });
    return this;
  }

  /** Copies the selection, if there is one. */
  async copy(): Promise<void> {
    if (!this.selectionHandler.hasSelection()) return;
    await this._clipboard.writeText(this.getSelectionText());
    if (this.configService.config.selection?.clear_on_copy) {
      this.selectionHandler.clearSelection();
    }
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

  /** Pastes the clipboard: an image as its file path, text into the line or the composer. */
  async paste(): Promise<void> {
    if (!this._terminal) return;

    const ttlSeconds = this.configService.config.clipboard?.image_paste_ttl_seconds ?? 60;
    const filePath = await this._clipboard.readImageFromClipboard(ttlSeconds * 1000);
    if (filePath !== null) {
      this.inputWriter.writeRaw(filePath.includes(" ") ? `"${filePath}"` : filePath);
      return;
    }

    let clipboardText: string;
    try {
      clipboardText = await this._clipboard.readText();
    } catch {
      return;
    }

    if (this.model.isCommandRunning) {
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
    const input = this.model.input;
    const cursor = Math.max(0, Math.min(input.cursorIndex, input.text.length));
    const pasted = clipboardText.replace(/\r\n/g, "\n");
    this.model.report({
      type: "composerRequested",
      seedText: input.text.slice(0, cursor) + pasted + input.text.slice(cursor),
      cursorIndex: cursor + pasted.length,
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
      const text = await this._clipboard.readText();
      this.pty.write(`\x1b]52;c;${bytesToBase64(new TextEncoder().encode(text))}\x07`);
    } catch {
      this.pty.write("\x1b]52;c;\x07");
    }
  }

  private async handleOsc52Write(base64Data: string): Promise<void> {
    const allowed = (this.configService.config.clipboard?.write ?? "allow") === "allow";
    if (!allowed) return;
    try {
      await this._clipboard.writeText(base64ToText(base64Data));
    } catch {
      // Silently ignore malformed base64
    }
  }

  private replaceSelectedInput(replacementText: string): boolean {
    if (!this.selectionHandler.hasSelection()) return false;

    const selectionRange = this.commandLineBuffer.selectedInputRange(
      this.model.input.maxCursorIndex,
    );
    if (!selectionRange) return false;

    const deleteLength = selectionRange.endIndex - selectionRange.startIndex;
    if (deleteLength <= 0) return false;

    const input = this.model.input;
    const nextText =
      input.text.slice(0, selectionRange.startIndex) +
      replacementText +
      input.text.slice(selectionRange.endIndex);
    this.selectionHandler.clearSelection();
    this.inputWriter.replaceInput(nextText, selectionRange.startIndex + replacementText.length);
    return true;
  }
}
