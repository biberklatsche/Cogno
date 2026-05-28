import { Clipboard } from "@cogno/app-tauri/clipboard";
import { OS } from "@cogno/app-tauri/os";
import { Terminal } from "@xterm/xterm";
import { IDisposable } from "../../../common/models/models";
import { IPty } from "../pty/pty";
import { ITerminalHandler } from "./handler";

const DEFAULT_RESUME_PATTERN =
  /\b([a-zA-Z][\w-]*)\s+(resume|--resume|-r)\s+([a-zA-Z0-9][a-zA-Z0-9_-]{7,})/gi;

export class AiAgentResumeActionHandler implements ITerminalHandler {
  private _terminal?: Terminal;
  private _linkProviderDisposable?: IDisposable;
  private readonly _patternSource: string;

  constructor(
    private readonly _pty: IPty,
    patternSource?: string,
  ) {
    this._patternSource = patternSource ?? DEFAULT_RESUME_PATTERN.source;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this._linkProviderDisposable = terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const lineText = this.readBufferLineText(bufferLineNumber);
        if (!lineText) {
          callback(undefined);
          return;
        }
        const matches = this.extractMatches(lineText);
        if (!matches.length) {
          callback(undefined);
          return;
        }
        callback(
          matches.map((match) => ({
            range: {
              start: { x: match.startIndex + 1, y: bufferLineNumber },
              end: { x: match.endIndexExclusive, y: bufferLineNumber },
            },
            text: match.text,
            decorations: { underline: true, pointerCursor: true },
            hover: () => {
              this._terminal?.element?.setAttribute("title", this.hoverHint);
            },
            leave: () => {
              this._terminal?.element?.removeAttribute("title");
            },
            activate: (event: MouseEvent, text: string) => {
              event.preventDefault();
              if (this.isExecuteModifierPressed(event)) {
                this._pty.write(`${text}\r`);
              } else {
                void Clipboard.writeText(text);
              }
            },
          })),
        );
      },
    });
    return this;
  }

  dispose(): void {
    this._linkProviderDisposable?.dispose();
    this._linkProviderDisposable = undefined;
    this._terminal?.element?.removeAttribute("title");
    this._terminal = undefined;
  }

  private readBufferLineText(bufferLineNumber: number): string {
    const line = this._terminal?.buffer.active.getLine(bufferLineNumber - 1);
    return line?.translateToString(true) ?? "";
  }

  private extractMatches(
    lineText: string,
  ): { text: string; startIndex: number; endIndexExclusive: number }[] {
    const pattern = new RegExp(this._patternSource, "gi");
    const out: { text: string; startIndex: number; endIndexExclusive: number }[] = [];
    for (const raw of lineText.matchAll(pattern)) {
      const start = raw.index ?? -1;
      if (start < 0) continue;
      out.push({ text: raw[0], startIndex: start, endIndexExclusive: start + raw[0].length });
    }
    return out;
  }

  private get hoverHint(): string {
    return `Click to copy · ${this.executeModifierLabel}+Click to run`;
  }

  private get executeModifierLabel(): string {
    return OS.platform() === "macos" ? "Cmd" : "Ctrl";
  }

  private isExecuteModifierPressed(event: MouseEvent): boolean {
    return OS.platform() === "macos" ? event.metaKey : event.ctrlKey;
  }
}
