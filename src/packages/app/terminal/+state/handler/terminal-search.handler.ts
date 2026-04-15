import { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { IDecoration, Terminal } from "@xterm/xterm";
import { Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { IDisposable } from "../../../common/models/models";
import { ConfigService } from "../../../config/+state/config.service";
import { TerminalId } from "../../../grid-list/+model/model";
import {
  TerminalSearchLineMatch,
  TerminalSearchLineResult,
  TerminalSearchRequestedEvent,
  TerminalSearchRevealRequestedEvent,
} from "../../+bus/events";
import { ITerminalHandler } from "./handler";

export class TerminalSearchHandler implements ITerminalHandler {
  private readonly subscription: Subscription = new Subscription();
  private readonly blockSearchDecorations: IDisposable[] = [];
  private terminal?: Terminal;
  private searchAddon?: SearchAddon;

  private searchDecorationOptions: ISearchOptions["decorations"];
  private blockSearchLineCache?: BlockSearchLineCache;
  private currentSearchRange?: TerminalSearchRange;

  constructor(
    private readonly bus: AppBus,
    private readonly terminalId: TerminalId,
    private readonly configService: ConfigService,
  ) {}

  registerSearchAddon(searchAddon: SearchAddon): void {
    this.searchAddon = searchAddon;
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this.terminal = terminal;
    const terminalWriteParsedDisposable = terminal.onWriteParsed(() => {
      this.clearBlockSearchLineCache();
    });
    this.subscription.add(() => {
      terminalWriteParsedDisposable.dispose();
    });

    this.subscription.add(
      this.bus
        .on$({ path: ["app", "terminal"], type: "TerminalSearchRequested" })
        .subscribe((event) => {
          this.handleSearchRequest(event);
        }),
    );
    this.subscription.add(
      this.bus
        .on$({ path: ["app", "terminal"], type: "TerminalSearchRevealRequested" })
        .subscribe((event) => {
          this.handleSearchRevealRequest(event);
        }),
    );
    this.subscription.add(
      this.configService.config$.subscribe((config) => {
        this.updateSearchDecorationOptions(
          config.search?.match?.background_color,
          config.search?.match?.border_color,
          config.search?.match?.overview_ruler_color,
          config.search?.active_match?.background_color,
          config.search?.active_match?.border_color,
          config.search?.active_match?.overview_ruler_color,
        );
      }),
    );

    return this;
  }

  dispose(): void {
    this.clearBlockSearchDecorations();
    this.clearBlockSearchLineCache();
    this.subscription.unsubscribe();
  }

  private handleSearchRequest(event: TerminalSearchRequestedEvent): void {
    const payload = event.payload;
    if (!payload) {
      return;
    }

    if (payload.terminalId && payload.terminalId !== this.terminalId) {
      return;
    }

    const query = payload.query.trim();
    const caseSensitive = payload.caseSensitive;
    const regularExpression = payload.regularExpression;
    const searchRange = this.normalizeSearchRange(payload.beginBufferLine, payload.endBufferLine);
    const cursorBufferLine = payload.cursorBufferLine;
    const resultLineLimit = payload.resultLineLimit;
    this.currentSearchRange = searchRange;
    if (query.length === 0) {
      this.clearBlockSearchDecorations();
      this.searchAddon?.clearDecorations();
      if (payload.terminalId === this.terminalId) {
        this.publishSearchResult(
          "",
          [],
          caseSensitive,
          regularExpression,
          searchRange,
          cursorBufferLine,
          false,
          undefined,
        );
      }
      return;
    }

    const searchOptions = this.createSearchOptions(caseSensitive, regularExpression);
    const searchExpression = this.createSearchExpression(query, caseSensitive, regularExpression);
    if (!searchExpression) {
      this.clearBlockSearchDecorations();
      this.searchAddon?.clearDecorations();
      this.publishSearchResult(
        query,
        [],
        caseSensitive,
        regularExpression,
        searchRange,
        cursorBufferLine,
        false,
        undefined,
      );
      return;
    }

    if (searchRange) {
      this.searchAddon?.clearDecorations();
    } else {
      this.clearBlockSearchDecorations();
      this.searchAddon?.findNext(query, searchOptions);
    }

    const pagedSearchResult = this.collectMatchingLines(
      searchExpression,
      searchRange,
      cursorBufferLine,
      resultLineLimit,
    );
    if (searchRange) {
      this.renderBlockSearchDecorations(pagedSearchResult.lines, cursorBufferLine === undefined);
    }
    this.publishSearchResult(
      query,
      pagedSearchResult.lines,
      caseSensitive,
      regularExpression,
      searchRange,
      cursorBufferLine,
      pagedSearchResult.hasMore,
      pagedSearchResult.nextCursorBufferLine,
    );
  }

  private handleSearchRevealRequest(event: TerminalSearchRevealRequestedEvent): void {
    const revealPayload = event.payload;
    if (!revealPayload) {
      return;
    }

    if (revealPayload.terminalId !== this.terminalId) {
      return;
    }

    if (revealPayload.query.trim().length === 0) {
      return;
    }

    const bufferLineIndex = revealPayload.lineNumber - 1;
    if (bufferLineIndex < 0) {
      return;
    }

    const revealSucceeded = this.activateSearchMatch(
      revealPayload.query,
      revealPayload.caseSensitive,
      revealPayload.regularExpression,
      bufferLineIndex,
      revealPayload.matchStartIndex,
      this.currentSearchRange,
    );
    if (!revealSucceeded) {
      const safeMatchLength = Math.max(1, revealPayload.matchLength);
      this.terminal?.select(revealPayload.matchStartIndex, bufferLineIndex, safeMatchLength);
    }

    this.scrollToBufferLine(bufferLineIndex);
  }

  private publishSearchResult(
    query: string,
    lines: TerminalSearchLineResult[],
    caseSensitive: boolean,
    regularExpression: boolean,
    searchRange: TerminalSearchRange | undefined,
    cursorBufferLine: number | undefined,
    hasMore: boolean,
    nextCursorBufferLine: number | undefined,
  ): void {
    this.bus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchResult",
      payload: {
        terminalId: this.terminalId,
        query,
        caseSensitive,
        regularExpression,
        beginBufferLine: searchRange?.beginBufferLine,
        endBufferLine: searchRange?.endBufferLine,
        cursorBufferLine,
        hasMore,
        nextCursorBufferLine,
        lines,
      },
    });
  }

  private collectMatchingLines(
    searchExpression: RegExp,
    searchRange?: TerminalSearchRange,
    cursorBufferLine?: number,
    resultLineLimit?: number,
  ): PagedTerminalSearchResult {
    const activeBuffer = this.terminal?.buffer.active;
    if (!activeBuffer) {
      return {
        lines: [],
        hasMore: false,
        nextCursorBufferLine: undefined,
      };
    }

    const matchingLines: TerminalSearchLineResult[] = [];
    const normalizedBeginBufferLine = Math.max(
      searchRange?.beginBufferLine ?? 1,
      cursorBufferLine ?? 1,
    );
    const normalizedEndBufferLine = searchRange?.endBufferLine ?? activeBuffer.length;
    const normalizedResultLineLimit = Math.max(1, resultLineLimit ?? Number.MAX_SAFE_INTEGER);
    if (normalizedBeginBufferLine > normalizedEndBufferLine) {
      return {
        lines: [],
        hasMore: false,
        nextCursorBufferLine: undefined,
      };
    }

    for (
      let lineNumber = normalizedBeginBufferLine - 1;
      lineNumber < normalizedEndBufferLine;
      lineNumber++
    ) {
      const lineText = this.resolveLineText(lineNumber, searchRange);
      if (lineText.length === 0) {
        continue;
      }

      const matches = this.findLineMatches(lineText, searchExpression);
      if (matches.length === 0) {
        continue;
      }

      matchingLines.push({
        lineNumber: lineNumber + 1,
        lineText,
        matches,
      });

      if (matchingLines.length >= normalizedResultLineLimit) {
        return {
          lines: matchingLines,
          hasMore: this.hasRemainingMatches(
            searchExpression,
            lineNumber + 1,
            normalizedEndBufferLine,
            searchRange,
          ),
          nextCursorBufferLine: lineNumber + 2,
        };
      }
    }

    return {
      lines: matchingLines,
      hasMore: false,
      nextCursorBufferLine: undefined,
    };
  }

  private resolveLineText(lineNumber: number, searchRange?: TerminalSearchRange): string {
    const activeBuffer = this.terminal?.buffer.active;
    if (!activeBuffer) {
      return "";
    }

    if (!searchRange) {
      return activeBuffer.getLine(lineNumber)?.translateToString(true) ?? "";
    }

    const blockSearchLineCache = this.getOrCreateBlockSearchLineCache(searchRange);
    const cachedLineText = blockSearchLineCache.lineTexts.get(lineNumber);
    if (cachedLineText !== undefined) {
      return cachedLineText;
    }

    const lineText = activeBuffer.getLine(lineNumber)?.translateToString(true) ?? "";
    blockSearchLineCache.lineTexts.set(lineNumber, lineText);
    return lineText;
  }

  private findLineMatches(lineText: string, searchRegex: RegExp): TerminalSearchLineMatch[] {
    const matches: TerminalSearchLineMatch[] = [];
    searchRegex.lastIndex = 0;

    let regexMatch: RegExpExecArray | null = searchRegex.exec(lineText);
    while (regexMatch) {
      matches.push({
        startIndex: regexMatch.index,
        endIndex: regexMatch.index + regexMatch[0].length,
      });
      regexMatch = searchRegex.exec(lineText);
    }

    return matches;
  }

  private createSearchExpression(
    query: string,
    caseSensitive: boolean,
    regularExpression: boolean,
  ): RegExp | undefined {
    const flags = caseSensitive ? "g" : "gi";
    const sourcePattern = regularExpression ? query : this.escapeRegExp(query);

    try {
      return new RegExp(sourcePattern, flags);
    } catch {
      return undefined;
    }
  }

  private createSearchOptions(caseSensitive: boolean, regularExpression: boolean): ISearchOptions {
    return {
      caseSensitive,
      regex: regularExpression,
      decorations: this.searchDecorationOptions,
    };
  }

  private createSearchNavigationOptions(
    caseSensitive: boolean,
    regularExpression: boolean,
  ): ISearchOptions {
    return {
      caseSensitive,
      regex: regularExpression,
    };
  }

  private activateSearchMatch(
    query: string,
    caseSensitive: boolean,
    regularExpression: boolean,
    targetBufferLineIndex: number,
    targetMatchStartIndex: number,
    searchRange?: TerminalSearchRange,
  ): boolean {
    if (!this.searchAddon || !this.terminal) {
      return false;
    }

    const searchExpression = this.createSearchExpression(query, caseSensitive, regularExpression);
    if (!searchExpression) {
      return false;
    }

    const searchOptions = searchRange
      ? this.createSearchNavigationOptions(caseSensitive, regularExpression)
      : this.createSearchOptions(caseSensitive, regularExpression);
    const searchAddonWithInternalOptions = this
      .searchAddon as unknown as SearchAddonWithInternalOptions;

    this.terminal.clearSelection();
    const firstFindSucceeded = searchAddonWithInternalOptions.findNext(query, searchOptions, {
      noScroll: true,
    });
    if (!firstFindSucceeded) {
      return false;
    }

    const maxIterations = this.terminal.buffer.active.length + this.terminal.rows;
    let firstSelectionKey: string | undefined;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const currentSelection = this.terminal.getSelectionPosition();
      if (
        searchRange &&
        currentSelection &&
        !this.selectionFallsWithinRange(currentSelection, searchRange)
      ) {
        const movedToNextMatch = searchAddonWithInternalOptions.findNext(query, searchOptions, {
          noScroll: true,
        });
        if (!movedToNextMatch) {
          return false;
        }
        continue;
      }

      if (
        this.matchesTargetSelection(currentSelection, targetBufferLineIndex, targetMatchStartIndex)
      ) {
        return true;
      }

      const currentSelectionKey = this.selectionKey(currentSelection);
      if (!currentSelectionKey) {
        return false;
      }

      if (!firstSelectionKey) {
        firstSelectionKey = currentSelectionKey;
      } else if (currentSelectionKey === firstSelectionKey) {
        return false;
      }

      const movedToNextMatch = searchAddonWithInternalOptions.findNext(query, searchOptions, {
        noScroll: true,
      });
      if (!movedToNextMatch) {
        return false;
      }
    }

    return false;
  }

  private normalizeSearchRange(
    beginBufferLine?: number,
    endBufferLine?: number,
  ): TerminalSearchRange | undefined {
    const activeBuffer = this.terminal?.buffer.active;
    if (!activeBuffer) {
      return undefined;
    }

    if (beginBufferLine === undefined && endBufferLine === undefined) {
      return undefined;
    }

    return {
      beginBufferLine: Math.max(1, beginBufferLine ?? 1),
      endBufferLine: Math.min(activeBuffer.length, endBufferLine ?? activeBuffer.length),
    };
  }

  private renderBlockSearchDecorations(
    matchingLines: ReadonlyArray<TerminalSearchLineResult>,
    clearExistingDecorations: boolean,
  ): void {
    if (clearExistingDecorations) {
      this.clearBlockSearchDecorations();
    }

    const terminal = this.terminal;
    const searchDecorationOptions = this.searchDecorationOptions;
    if (!terminal || !searchDecorationOptions) {
      return;
    }

    for (const matchingLine of matchingLines) {
      for (const match of matchingLine.matches) {
        const marker = terminal.registerMarker(
          -terminal.buffer.active.baseY -
            terminal.buffer.active.cursorY +
            (matchingLine.lineNumber - 1),
        );
        const decoration = terminal.registerDecoration({
          marker,
          x: match.startIndex,
          width: Math.max(1, match.endIndex - match.startIndex),
          backgroundColor: searchDecorationOptions.matchBackground,
          overviewRulerOptions: {
            color: searchDecorationOptions.matchOverviewRuler,
            position: "center",
          },
        });
        if (!decoration) {
          marker.dispose();
          continue;
        }

        this.applyBlockSearchDecorationStyles(decoration, searchDecorationOptions.matchBorder);
        this.blockSearchDecorations.push(decoration);
        this.blockSearchDecorations.push(marker);
      }
    }
  }

  private applyBlockSearchDecorationStyles(decoration: IDecoration, borderColor?: string): void {
    const decorationDisposables: IDisposable[] = [];
    decorationDisposables.push(
      decoration.onRender((element) => {
        element.classList.add("xterm-find-result-decoration");
        if (borderColor) {
          element.style.outline = `1px solid ${borderColor}`;
        }
      }),
    );
    decorationDisposables.push(
      decoration.onDispose(() => {
        for (const decorationDisposable of decorationDisposables) {
          decorationDisposable.dispose();
        }
      }),
    );
    this.blockSearchDecorations.push(...decorationDisposables);
  }

  private clearBlockSearchDecorations(): void {
    while (this.blockSearchDecorations.length > 0) {
      this.blockSearchDecorations.pop()?.dispose();
    }
  }

  private getOrCreateBlockSearchLineCache(searchRange: TerminalSearchRange): BlockSearchLineCache {
    if (
      this.blockSearchLineCache &&
      this.blockSearchLineCache.beginBufferLine === searchRange.beginBufferLine &&
      this.blockSearchLineCache.endBufferLine === searchRange.endBufferLine
    ) {
      return this.blockSearchLineCache;
    }

    this.blockSearchLineCache = {
      beginBufferLine: searchRange.beginBufferLine,
      endBufferLine: searchRange.endBufferLine,
      lineTexts: new Map<number, string>(),
    };
    return this.blockSearchLineCache;
  }

  private clearBlockSearchLineCache(): void {
    this.blockSearchLineCache = undefined;
  }

  private hasRemainingMatches(
    searchExpression: RegExp,
    startLineIndex: number,
    endBufferLine: number,
    searchRange?: TerminalSearchRange,
  ): boolean {
    for (let lineNumber = startLineIndex; lineNumber < endBufferLine; lineNumber++) {
      const lineText = this.resolveLineText(lineNumber, searchRange);
      if (lineText.length === 0) {
        continue;
      }

      searchExpression.lastIndex = 0;
      if (searchExpression.test(lineText)) {
        return true;
      }
    }

    return false;
  }

  private updateSearchDecorationOptions(
    matchBackgroundColor?: string,
    matchBorderColor?: string,
    matchOverviewRulerColor?: string,
    activeMatchBackgroundColor?: string,
    activeMatchBorderColor?: string,
    activeMatchOverviewRulerColor?: string,
  ): void {
    const matchOverviewRuler = this.toCssColor(matchOverviewRulerColor);
    const activeMatchColorOverviewRuler = this.toCssColor(activeMatchOverviewRulerColor);
    if (!matchOverviewRuler || !activeMatchColorOverviewRuler) {
      this.searchDecorationOptions = undefined;
      return;
    }

    this.searchDecorationOptions = {
      matchBackground: this.toCssColor(matchBackgroundColor),
      matchBorder: this.toCssColor(matchBorderColor),
      matchOverviewRuler,
      activeMatchBackground: this.toCssColor(activeMatchBackgroundColor),
      activeMatchBorder: this.toCssColor(activeMatchBorderColor),
      activeMatchColorOverviewRuler,
    };
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private toCssColor(hexColor?: string): string | undefined {
    if (!hexColor) {
      return undefined;
    }
    return `#${hexColor}`;
  }

  private matchesTargetSelection(
    selection: TerminalSelectionRange | undefined,
    targetBufferLineIndex: number,
    targetMatchStartIndex: number,
  ): boolean {
    if (!selection) {
      return false;
    }

    return (
      selection.start.y === targetBufferLineIndex && selection.start.x === targetMatchStartIndex
    );
  }

  private selectionFallsWithinRange(
    selection: TerminalSelectionRange,
    searchRange: TerminalSearchRange,
  ): boolean {
    const startBufferLine = selection.start.y + 1;
    const endBufferLine = selection.end.y + 1;
    return (
      startBufferLine >= searchRange.beginBufferLine && endBufferLine <= searchRange.endBufferLine
    );
  }

  private selectionKey(selection: TerminalSelectionRange | undefined): string | undefined {
    if (!selection) {
      return undefined;
    }

    return `${selection.start.y}:${selection.start.x}:${selection.end.y}:${selection.end.x}`;
  }

  private scrollToBufferLine(bufferLineIndex: number): void {
    const activeBuffer = this.terminal?.buffer.active;
    if (!activeBuffer || !this.terminal) {
      return;
    }

    const viewportLineIndex = activeBuffer.viewportY;
    const halfVisibleRows = Math.floor(this.terminal.rows / 2);
    const desiredScrollDistance = bufferLineIndex - viewportLineIndex - halfVisibleRows;
    this.terminal.scrollLines(desiredScrollDistance);
  }
}

type TerminalSelectionPoint = {
  x: number;
  y: number;
};

type TerminalSelectionRange = {
  start: TerminalSelectionPoint;
  end: TerminalSelectionPoint;
};

type SearchAddonWithInternalOptions = SearchAddon & {
  findNext(
    term: string,
    searchOptions?: ISearchOptions,
    internalSearchOptions?: {
      noScroll?: boolean;
    },
  ): boolean;
};

type TerminalSearchRange = {
  beginBufferLine: number;
  endBufferLine: number;
};

type BlockSearchLineCache = {
  beginBufferLine: number;
  endBufferLine: number;
  lineTexts: Map<number, string>;
};

type PagedTerminalSearchResult = {
  lines: TerminalSearchLineResult[];
  hasMore: boolean;
  nextCursorBufferLine?: number;
};
