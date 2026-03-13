import {SearchAddon, ISearchOptions} from "@xterm/addon-search";
import {Terminal} from "@xterm/xterm";
import {Subscription} from "rxjs";
import {TerminalId} from "../../../grid-list/+model/model";
import {AppBus} from "../../../app-bus/app-bus";
import {IDisposable} from "../../../common/models/models";
import {ITerminalHandler} from "./handler";
import {ConfigService} from "../../../config/+state/config.service";
import {
    TerminalSearchLineMatch,
    TerminalSearchLineResult,
    TerminalSearchRevealRequestedEvent,
    TerminalSearchRequestedEvent
} from "../../+bus/events";

export class TerminalSearchHandler implements ITerminalHandler {

    private readonly subscription: Subscription = new Subscription();
    private terminal?: Terminal;
    private searchAddon?: SearchAddon;

    private searchDecorationOptions: ISearchOptions["decorations"];

    constructor(
        private readonly bus: AppBus,
        private readonly terminalId: TerminalId,
        private readonly configService: ConfigService,
    ) {
    }

    registerSearchAddon(searchAddon: SearchAddon): void {
        this.searchAddon = searchAddon;
    }

    registerTerminal(terminal: Terminal): IDisposable {
        this.terminal = terminal;

        this.subscription.add(
            this.bus.on$({path: ["app", "terminal"], type: "TerminalSearchRequested"}).subscribe((event) => {
                this.handleSearchRequest(event);
            })
        );
        this.subscription.add(
            this.bus.on$({path: ["app", "terminal"], type: "TerminalSearchRevealRequested"}).subscribe((event) => {
                this.handleSearchRevealRequest(event);
            })
        );
        this.subscription.add(
            this.configService.config$.subscribe((config) => {
                this.updateSearchDecorationOptions(
                    config.terminal_search?.match_background_color,
                    config.terminal_search?.match_border_color,
                    config.terminal_search?.match_overview_ruler_color,
                    config.terminal_search?.active_match_background_color,
                    config.terminal_search?.active_match_border_color,
                    config.terminal_search?.active_match_overview_ruler_color,
                );
            })
        );

        return this;
    }

    dispose(): void {
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
        if (query.length === 0) {
            this.searchAddon?.clearDecorations();
            if (payload.terminalId === this.terminalId) {
                this.publishSearchResult("", [], caseSensitive, regularExpression);
            }
            return;
        }

        const searchOptions = this.createSearchOptions(caseSensitive, regularExpression);
        const searchExpression = this.createSearchExpression(query, caseSensitive, regularExpression);
        if (!searchExpression) {
            this.searchAddon?.clearDecorations();
            this.publishSearchResult(query, [], caseSensitive, regularExpression);
            return;
        }

        this.searchAddon?.findNext(query, searchOptions);

        const matchingLines = this.collectMatchingLines(searchExpression);
        this.publishSearchResult(query, matchingLines, caseSensitive, regularExpression);
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
    ): void {
        this.bus.publish({
            path: ["app", "terminal"],
            type: "TerminalSearchResult",
            payload: {
                terminalId: this.terminalId,
                query,
                caseSensitive,
                regularExpression,
                lines,
            }
        });
    }

    private collectMatchingLines(searchExpression: RegExp): TerminalSearchLineResult[] {
        const activeBuffer = this.terminal?.buffer.active;
        if (!activeBuffer) {
            return [];
        }

        const matchingLines: TerminalSearchLineResult[] = [];

        for (let lineNumber = 0; lineNumber < activeBuffer.length; lineNumber++) {
            const lineText = activeBuffer.getLine(lineNumber)?.translateToString(true) ?? "";
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
        }

        return matchingLines;
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

    private activateSearchMatch(
        query: string,
        caseSensitive: boolean,
        regularExpression: boolean,
        targetBufferLineIndex: number,
        targetMatchStartIndex: number,
    ): boolean {
        if (!this.searchAddon || !this.terminal) {
            return false;
        }

        const searchExpression = this.createSearchExpression(query, caseSensitive, regularExpression);
        if (!searchExpression) {
            return false;
        }

        const searchOptions = this.createSearchOptions(caseSensitive, regularExpression);
        const searchAddonWithInternalOptions = this.searchAddon as unknown as SearchAddonWithInternalOptions;

        this.terminal.clearSelection();
        const firstFindSucceeded = searchAddonWithInternalOptions.findNext(query, searchOptions, {noScroll: true});
        if (!firstFindSucceeded) {
            return false;
        }

        const maxIterations = this.terminal.buffer.active.length + this.terminal.rows;
        let firstSelectionKey: string | undefined;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            const currentSelection = this.terminal.getSelectionPosition();
            if (this.matchesTargetSelection(currentSelection, targetBufferLineIndex, targetMatchStartIndex)) {
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

            const movedToNextMatch = searchAddonWithInternalOptions.findNext(query, searchOptions, {noScroll: true});
            if (!movedToNextMatch) {
                return false;
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

        return selection.start.y === targetBufferLineIndex && selection.start.x === targetMatchStartIndex;
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
