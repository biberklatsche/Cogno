import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { Opener } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import { IDisposable } from "@cogno/shared/support";
import { Terminal } from "@xterm/xterm";
import { SessionModel } from "../model/session-model";
import { TerminalPathResolver } from "./terminal-path.resolver";

type LinkMatch = {
  text: string;
  startIndex: number;
  endIndexExclusive: number;
  kind: "url" | "path";
};

/** One screen row of a line that the terminal wrapped, and where its text sits in the joined line. */
type RowSegment = { row: number; start: number; end: number };

type LogicalLine = { text: string; segments: RowSegment[] };

/**
 * What an OSC 8 hyperlink may point to. Its text hides the target, so only
 * these are opened; anything else is still copied on a plain click.
 */
const HYPERLINK_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Recognises links in the output - URLs and paths by their text, and the
 * hyperlinks a program marks with OSC 8 - and gives them one behaviour: a
 * click copies the target, a click with the open modifier opens it.
 */
export class LinkHandler implements ITerminalHandler {
  private static readonly URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
  private static readonly PATH_PATTERN =
    /(?:[A-Za-z]:(?:\\|\/)[^\s<>"'`]+|(?:\\\\|\/\/)[^\s<>"'`]+|\/[A-Za-z]:(?:\/[^\n<>"'`]+)+|\/[^\s<>"'`]+|(?:\.\.?(?:\\|\/))[^\s<>"'`]+|(?:[^/\\\s<>"'`:()[\]{},;=]+(?:[\\/][^\s<>"'`:()[\]{},;=]+)+))/g;
  /** A path with spaces is only recognisable by its quotes. */
  private static readonly QUOTED_PATTERN = /(["'`])([^"'`]*\s[^"'`]*)\1/g;
  /**
   * Quoted text counts as a path only if it starts like one. Prose that merely
   * contains a slash ("see /tmp for details") must not become one long link.
   */
  private static readonly QUOTED_PATH_START = /^(?:[A-Za-z]:[\\/]|\\\\|\/|\.\.?[\\/]|~[\\/])/;
  /** How many screen rows of one wrapped line are joined at most. */
  private static readonly MAX_WRAPPED_ROWS = 50;
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

  private _terminal?: Terminal;
  private _linkProviderDisposable?: IDisposable;
  private readonly _pathResolver = new TerminalPathResolver();

  constructor(
    private readonly _clipboard: ClipboardAccess,
    private readonly _model: SessionModel,
    private readonly _opener: Opener,
    private readonly _os: OsPlatform,
  ) {}

  registerTerminal(terminal: Terminal): IDisposable {
    this._linkProviderDisposable?.dispose();
    this._terminal = terminal;
    // OSC 8: the terminal finds the hyperlinks itself and asks what a click does.
    terminal.options.linkHandler = {
      // The terminal would drop everything but http(s); `openHyperlink` decides instead.
      allowNonHttpProtocols: true,
      activate: (event, uri) => {
        event.preventDefault();
        if (this.isOpenModifierPressed(event)) {
          void this.openHyperlink(uri);
        } else {
          void this.copy(uri);
        }
      },
      // The link's text says nothing about where it leads; the hint does.
      hover: (_event, uri) => {
        this._terminal?.element?.setAttribute("title", `${uri}\n${this.hoverHint}`);
      },
      leave: () => {
        this._terminal?.element?.removeAttribute("title");
      },
    };
    this._linkProviderDisposable = terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const logicalLine = this.readLogicalLine(bufferLineNumber);
        if (!logicalLine?.text) {
          callback(undefined);
          return;
        }
        const matches = this.extractMatches(logicalLine.text);
        if (matches.length === 0) {
          callback(undefined);
          return;
        }
        callback(
          matches.map((match) => ({
            range: {
              start: this.positionOf(match.startIndex, logicalLine.segments),
              end: this.positionOf(match.endIndexExclusive - 1, logicalLine.segments),
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
                  this._model.state.cwd,
                  this._model.pathAdapter,
                );
                if (!backendPath) return;
                void this._opener.openPath(backendPath);
              } else {
                void this.copy(text);
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
    if (this._terminal) this._terminal.options.linkHandler = null;
    this._terminal = undefined;
  }

  /** Copies a link's target and says so: a click on a link shows nothing by itself. */
  private async copy(target: string): Promise<void> {
    await this._clipboard.writeText(target);
    this._model.report({ type: "linkCopied", target });
  }

  /**
   * Opens the target of an OSC 8 hyperlink: web and mail addresses as they
   * are, a `file:` link as a path of this session (`ls --hyperlink`), so it
   * goes through the same translation as a path printed in the output. A
   * `file:` link names the machine the file is on; one from another machine
   * (an SSH session) is not opened - the same path here is a different file.
   */
  private async openHyperlink(uri: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      return;
    }
    if (HYPERLINK_URL_PROTOCOLS.has(url.protocol)) {
      await this._opener.openUrl(uri).catch(() => undefined);
      return;
    }
    if (url.protocol !== "file:" || !(await this.isThisMachine(url.hostname))) return;
    let path: string;
    try {
      // `file:///C:/dir` has the path `/C:/dir`: the drive is not below a root.
      path = decodeURIComponent(url.pathname).replace(/^\/(?=[A-Za-z]:)/, "");
    } catch {
      return;
    }
    const backendPath = this._pathResolver.resolvePathForOpen(
      path,
      this._model.state.cwd,
      this._model.pathAdapter,
    );
    if (!backendPath) return;
    await this._opener.openPath(backendPath).catch(() => undefined);
  }

  private async isThisMachine(host: string): Promise<boolean> {
    if (host === "" || host === "localhost") return true;
    return (await this._os.hostname())?.toLowerCase() === host.toLowerCase();
  }

  /**
   * The whole line a screen row belongs to: a line longer than the terminal is
   * wide is wrapped onto several rows, and a path can run across them.
   */
  private readLogicalLine(bufferLineNumber: number): LogicalLine | undefined {
    const buffer = this._terminal?.buffer.active;
    if (!buffer) return undefined;

    let row = bufferLineNumber - 1;
    for (let steps = 0; steps < LinkHandler.MAX_WRAPPED_ROWS && row > 0; steps++) {
      if (!buffer.getLine(row)?.isWrapped) break;
      row--;
    }

    const segments: RowSegment[] = [];
    let text = "";
    for (let count = 0; count < LinkHandler.MAX_WRAPPED_ROWS; count++) {
      const line = buffer.getLine(row);
      if (!line) break;
      const continues = buffer.getLine(row + 1)?.isWrapped === true;
      // Only the last row is trimmed: a space at the wrap point belongs to the text.
      const rowText = line.translateToString(!continues);
      segments.push({ row, start: text.length, end: text.length + rowText.length });
      text += rowText;
      if (!continues) break;
      row++;
    }

    return segments.length > 0 ? { text, segments } : undefined;
  }

  /** The 1-based terminal position of the character at `index` of the joined line. */
  private positionOf(index: number, segments: RowSegment[]): { x: number; y: number } {
    const segment =
      segments.find((candidate) => index < candidate.end) ?? segments[segments.length - 1];
    return { x: index - segment.start + 1, y: segment.row + 1 };
  }

  private extractMatches(lineText: string): LinkMatch[] {
    const matches: LinkMatch[] = [];
    for (const candidate of this.collect(LinkHandler.URL_PATTERN, lineText, "url")) {
      matches.push(candidate);
    }

    const pathCandidates = [
      ...this.collectQuotedPaths(lineText),
      ...this.collect(LinkHandler.PATH_PATTERN, lineText, "path"),
    ];
    for (const candidate of pathCandidates) {
      if (matches.some((existing) => this.overlaps(existing, candidate))) continue;
      if (
        !this._pathResolver.resolvePathForOpen(
          candidate.text,
          this._model.state.cwd,
          this._model.pathAdapter,
        )
      )
        continue;
      matches.push(candidate);
    }

    return matches.sort((a, b) => a.startIndex - b.startIndex);
  }

  /** Quoted paths with spaces, without their quotes. */
  private collectQuotedPaths(lineText: string): LinkMatch[] {
    const out: LinkMatch[] = [];
    const pattern = new RegExp(LinkHandler.QUOTED_PATTERN);
    for (let raw = pattern.exec(lineText); raw; raw = pattern.exec(lineText)) {
      const start = raw.index;
      const end = start + raw[0].length;
      const text = raw[2];
      // A quote inside a word is an apostrophe ("don't"), and it may be the closing quote of a
      // pair that starts right here: look again from the next character.
      if (
        LinkHandler.isWordCharacter(lineText[start - 1]) ||
        LinkHandler.isWordCharacter(lineText[end]) ||
        !LinkHandler.QUOTED_PATH_START.test(text)
      ) {
        pattern.lastIndex = start + 1;
        continue;
      }
      out.push({ kind: "path", text, startIndex: start + 1, endIndexExclusive: end - 1 });
    }
    return out;
  }

  private static isWordCharacter(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z0-9_]/.test(character);
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
    return this._os.platform() === "macos" ? "Cmd" : "Ctrl";
  }

  private isOpenModifierPressed(event: MouseEvent): boolean {
    return this._os.platform() === "macos" ? event.metaKey : event.ctrlKey;
  }
}
