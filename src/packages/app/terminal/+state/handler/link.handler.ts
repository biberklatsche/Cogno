import { Clipboard } from "@cogno/app-tauri/clipboard";
import { OS } from "@cogno/app-tauri/os";
import { Opener } from "@cogno/core-api";
import { IDisposable } from "@cogno/core-support";
import { Terminal } from "@xterm/xterm";
import { TerminalPathResolver } from "../advanced/path/terminal-path.resolver";
import { TerminalStateManager } from "../state";
import { ITerminalHandler } from "./handler";

type LinkMatch = {
  text: string;
  startIndex: number;
  endIndexExclusive: number;
  kind: "url" | "path";
};

type LineSegment = { row0: number; start: number; end: number };

export class LinkHandler implements ITerminalHandler {
  private static readonly URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
  private static readonly PATH_PATTERN =
    /(?:"[^"\n]+"|'[^'\n]+'|`[^`\n]+`|[A-Za-z]:(?:\\|\/)[^\s<>"'`]+|(?:\\\\|\/\/)[^\s<>"'`]+|\/[A-Za-z]:(?:\/[^\n<>"'`]+)+|\/[^\s<>"'`]+|(?:\.\.?(?:\\|\/))[^\s<>"'`]+|(?:[^/\\\s<>"'`:()[\]{},;=]+(?:[\\/][^\s<>"'`:()[\]{},;=]+)+))/g;
  private static readonly LEADING_STRIP = new Set(["'", '"', "`", "(", "["]);
  private static readonly TRAILING_STRIP = new Set([
    ".",
    ",",
    ";",
    ":",
    "!",
    "?",
    "'",
    '"',
    "`",
    "]",
    ")",
  ]);
  private static readonly MAX_WRAPPED_ROWS = 50;

  private _terminal?: Terminal;
  private _linkProviderDisposable?: IDisposable;

  constructor(
    private readonly _stateManager: TerminalStateManager,
    private readonly _opener: Opener,
    private readonly _pathResolver: TerminalPathResolver = new TerminalPathResolver(),
  ) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._linkProviderDisposable?.dispose();
    this._terminal = terminal;
    this._linkProviderDisposable = terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const logicalLine = this.readLogicalLine(bufferLineNumber);
        if (!logicalLine || !logicalLine.text) {
          callback(undefined);
          return;
        }
        const matches = this.extractMatches(logicalLine.text);
        if (matches.length === 0) {
          callback(undefined);
          return;
        }
        callback(
          matches.map((match) => {
            const start = this.mapOffsetToPosition(match.startIndex, logicalLine.segments);
            const end = this.mapOffsetToPosition(match.endIndexExclusive, logicalLine.segments);
            return {
              range: {
                start: { x: start.col + 1, y: start.row0 + 1 },
                end: { x: end.col, y: end.row0 + 1 },
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
                if (this.isOpenModifierPressed(event)) {
                  if (match.kind === "url") {
                    void this._opener.openUrl(text);
                    return;
                  }
                  const backendPath = this._pathResolver.resolvePathForOpen(
                    text,
                    this._stateManager.state.cwd,
                    this._stateManager.pathAdapter,
                  );
                  if (!backendPath) return;
                  void this._opener.openPath(backendPath);
                } else {
                  void Clipboard.writeText(text);
                }
              },
            };
          }),
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

  private readLogicalLine(
    bufferLineNumber: number,
  ): { text: string; segments: LineSegment[] } | undefined {
    const buffer = this._terminal?.buffer.active;
    if (!buffer) return undefined;

    let startRow0 = bufferLineNumber - 1;
    for (let i = 0; i < LinkHandler.MAX_WRAPPED_ROWS && startRow0 > 0; i++) {
      if (!buffer.getLine(startRow0)?.isWrapped) break;
      startRow0--;
    }

    const segments: LineSegment[] = [];
    let text = "";
    let row0 = startRow0;
    for (let i = 0; i < LinkHandler.MAX_WRAPPED_ROWS; i++) {
      const line = buffer.getLine(row0);
      if (!line) break;
      const lineText = line.translateToString(true);
      segments.push({ row0, start: text.length, end: text.length + lineText.length });
      text += lineText;
      const nextLine = buffer.getLine(row0 + 1);
      if (!nextLine?.isWrapped) break;
      row0++;
    }

    return segments.length > 0 ? { text, segments } : undefined;
  }

  private mapOffsetToPosition(offset: number, segments: LineSegment[]): { row0: number; col: number } {
    for (const segment of segments) {
      if (offset <= segment.end) {
        return { row0: segment.row0, col: offset - segment.start };
      }
    }
    const last = segments[segments.length - 1];
    return { row0: last.row0, col: offset - last.start };
  }

  private extractMatches(lineText: string): LinkMatch[] {
    const matches: LinkMatch[] = [];
    for (const candidate of this.collect(LinkHandler.URL_PATTERN, lineText, "url")) {
      matches.push(candidate);
    }

    for (const candidate of this.collect(LinkHandler.PATH_PATTERN, lineText, "path")) {
      if (matches.some((existing) => this.overlaps(existing, candidate))) continue;
      if (
        !this._pathResolver.resolvePathForOpen(
          candidate.text,
          this._stateManager.state.cwd,
          this._stateManager.pathAdapter,
        )
      )
        continue;
      matches.push(candidate);
    }

    return matches.sort((a, b) => a.startIndex - b.startIndex);
  }

  private collect(pattern: RegExp, lineText: string, kind: "url" | "path"): LinkMatch[] {
    const out: LinkMatch[] = [];
    for (const raw of lineText.matchAll(pattern)) {
      const token = raw[0];
      const start = raw.index ?? -1;
      if (start < 0) continue;
      const cleaned = this.trimToken(token);
      if (!cleaned.text) continue;
      out.push({
        kind,
        text: cleaned.text,
        startIndex: start + cleaned.leadingTrim,
        endIndexExclusive: start + token.length - cleaned.trailingTrim,
      });
    }
    return out;
  }

  private trimToken(token: string): { text: string; leadingTrim: number; trailingTrim: number } {
    let start = 0;
    let end = token.length;
    while (start < end && LinkHandler.LEADING_STRIP.has(token[start])) start++;
    while (end > start && LinkHandler.TRAILING_STRIP.has(token[end - 1])) end--;
    return {
      text: token.slice(start, end),
      leadingTrim: start,
      trailingTrim: token.length - end,
    };
  }

  private overlaps(a: LinkMatch, b: LinkMatch): boolean {
    return a.startIndex < b.endIndexExclusive && b.startIndex < a.endIndexExclusive;
  }

  private get hoverHint(): string {
    return `Click to copy · ${this.openModifierLabel}+Click to open`;
  }

  private get openModifierLabel(): string {
    return OS.platform() === "macos" ? "Cmd" : "Ctrl";
  }

  private isOpenModifierPressed(event: MouseEvent): boolean {
    return OS.platform() === "macos" ? event.metaKey : event.ctrlKey;
  }
}
