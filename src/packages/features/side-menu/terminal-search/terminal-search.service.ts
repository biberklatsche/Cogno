import {DestroyRef, Inject, Injectable, Signal, signal} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {
    TerminalSearchHostPortContract,
    TerminalSearchLineResultContract,
    TerminalSearchRevealRequestContract,
    TerminalSearchTerminalIdContract,
    terminalSearchHostPortToken
} from "@cogno/core-sdk";
import { AppBus } from "@cogno/app/app-bus/app-bus";

@Injectable({providedIn: "root"})
export class TerminalSearchService {
    private readonly searchInputDebounceMilliseconds = 120;
    private readonly resultPageLineLimit = 200;
    private readonly defaultMatchBackgroundColor = "var(--highlight-color-ct2)";
    private readonly defaultMatchBorderColor = "var(--highlight-color)";
    private readonly searchQuerySignal = signal<string>("");
    private readonly searchResultsSignal = signal<ReadonlyArray<TerminalSearchLineResultContract>>([]);
    private readonly caseSensitiveSignal = signal<boolean>(false);
    private readonly regularExpressionSignal = signal<boolean>(false);
    private readonly matchBackgroundColorSignal = signal<string>(this.defaultMatchBackgroundColor);
    private readonly matchBorderColorSignal = signal<string>(this.defaultMatchBorderColor);
    private readonly activeTerminalIdSignal = signal<TerminalSearchTerminalIdContract | undefined>(undefined);
    private readonly beginBufferLineSignal = signal<number | undefined>(undefined);
    private readonly endBufferLineSignal = signal<number | undefined>(undefined);
    private readonly hasMoreResultsSignal = signal<boolean>(false);
    private readonly nextCursorBufferLineSignal = signal<number | undefined>(undefined);
    private pendingSearchTimeoutHandle?: ReturnType<typeof setTimeout>;

    readonly searchQuery: Signal<string> = this.searchQuerySignal.asReadonly();
    readonly searchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>> = this.searchResultsSignal.asReadonly();
    readonly caseSensitive: Signal<boolean> = this.caseSensitiveSignal.asReadonly();
    readonly regularExpression: Signal<boolean> = this.regularExpressionSignal.asReadonly();
    readonly matchBackgroundColor: Signal<string> = this.matchBackgroundColorSignal.asReadonly();
    readonly matchBorderColor: Signal<string> = this.matchBorderColorSignal.asReadonly();
    readonly beginBufferLine: Signal<number | undefined> = this.beginBufferLineSignal.asReadonly();
    readonly endBufferLine: Signal<number | undefined> = this.endBufferLineSignal.asReadonly();
    readonly hasMoreResults: Signal<boolean> = this.hasMoreResultsSignal.asReadonly();

    constructor(
        @Inject(terminalSearchHostPortToken)
        private readonly terminalSearchHostPort: TerminalSearchHostPortContract,
        private readonly appBus: AppBus,
        private readonly destroyRef: DestroyRef,
    ) {
        this.terminalSearchHostPort.terminalSearchResult$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((terminalSearchResult) => {
                this.handleSearchResult(terminalSearchResult);
            });

        this.terminalSearchHostPort.terminalSearchColorConfig$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((terminalSearchColorConfig) => {
                this.updateSearchColors(
                    terminalSearchColorConfig.matchBackgroundColor,
                    terminalSearchColorConfig.matchBorderColor,
                );
            });

        this.appBus.onType$("TerminalSearchPanelRequested", { path: ["app", "terminal"] })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((terminalSearchPanelRequestedEvent) => {
                const terminalSearchPanelPayload = terminalSearchPanelRequestedEvent.payload;
                if (!terminalSearchPanelPayload) {
                    return;
                }

                this.activeTerminalIdSignal.set(terminalSearchPanelPayload.terminalId);
                this.beginBufferLineSignal.set(terminalSearchPanelPayload.beginBufferLine);
                this.endBufferLineSignal.set(terminalSearchPanelPayload.endBufferLine);
            });
    }

    submitSearchQuery(query: string): void {
        this.searchQuerySignal.set(query);
        this.scheduleSearch(query);
    }

    repeatSearch(): void {
        this.cancelPendingSearch();
        this.searchInActiveTerminal(this.searchQuerySignal(), undefined);
    }

    loadMoreSearchResults(): void {
        const nextCursorBufferLine = this.nextCursorBufferLineSignal();
        if (nextCursorBufferLine === undefined) {
            return;
        }

        this.cancelPendingSearch();
        this.searchInActiveTerminal(this.searchQuerySignal(), nextCursorBufferLine);
    }

    toggleCaseSensitive(): void {
        this.caseSensitiveSignal.update((isCaseSensitive: boolean) => !isCaseSensitive);
        this.repeatSearch();
    }

    toggleRegularExpression(): void {
        this.regularExpressionSignal.update((isRegularExpressionEnabled: boolean) => !isRegularExpressionEnabled);
        this.repeatSearch();
    }

    updateBeginBufferLine(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.beginBufferLineSignal.set(this.parseBufferLine(inputElement.value));
        this.scheduleSearch(this.searchQuerySignal());
    }

    updateEndBufferLine(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.endBufferLineSignal.set(this.parseBufferLine(inputElement.value));
        this.scheduleSearch(this.searchQuerySignal());
    }

    revealSearchResult(searchLine: TerminalSearchLineResultContract): void {
        const activeTerminalId = this.activeTerminalIdSignal();
        if (!activeTerminalId) {
            return;
        }

        const firstLineMatch = searchLine.matches.at(0);
        if (!firstLineMatch) {
            return;
        }

        const revealPayload: TerminalSearchRevealRequestContract = {
            terminalId: activeTerminalId,
            query: this.searchQuerySignal().trim(),
            caseSensitive: this.caseSensitiveSignal(),
            regularExpression: this.regularExpressionSignal(),
            lineNumber: searchLine.lineNumber,
            matchStartIndex: firstLineMatch.startIndex,
            matchLength: firstLineMatch.endIndex - firstLineMatch.startIndex,
        };

        this.terminalSearchHostPort.requestReveal(revealPayload);
    }

    handleSideMenuOpen(): void {
        this.registerKeybindListener();
        const currentQuery = this.searchQuerySignal();
        if (currentQuery.length > 0) {
            this.searchInActiveTerminal(currentQuery, undefined);
        }
    }

    handleSideMenuClose(): void {
        this.cancelPendingSearch();
        this.unregisterKeybindListener();
        this.clearDecorationsInAllTerminals();
        this.searchQuerySignal.set("");
        this.searchResultsSignal.set([]);
        this.caseSensitiveSignal.set(false);
        this.regularExpressionSignal.set(false);
        this.activeTerminalIdSignal.set(undefined);
        this.beginBufferLineSignal.set(undefined);
        this.endBufferLineSignal.set(undefined);
        this.hasMoreResultsSignal.set(false);
        this.nextCursorBufferLineSignal.set(undefined);
    }

    private registerKeybindListener(): void {
        // handled by host integration layer
    }

    private unregisterKeybindListener(): void {
        // handled by host integration layer
    }

    private scheduleSearch(query: string): void {
        this.cancelPendingSearch();
        this.pendingSearchTimeoutHandle = setTimeout(() => {
            this.pendingSearchTimeoutHandle = undefined;
            this.searchInActiveTerminal(query, undefined);
        }, this.searchInputDebounceMilliseconds);
    }

    private cancelPendingSearch(): void {
        if (this.pendingSearchTimeoutHandle === undefined) {
            return;
        }

        clearTimeout(this.pendingSearchTimeoutHandle);
        this.pendingSearchTimeoutHandle = undefined;
    }

    private searchInActiveTerminal(query: string, cursorBufferLine: number | undefined): void {
        const activeTerminalId = this.activeTerminalIdSignal() ?? this.terminalSearchHostPort.getFocusedTerminalId();
        this.activeTerminalIdSignal.set(activeTerminalId);

        if (!activeTerminalId) {
            this.searchResultsSignal.set([]);
            this.hasMoreResultsSignal.set(false);
            this.nextCursorBufferLineSignal.set(undefined);
            return;
        }

        this.terminalSearchHostPort.requestSearch({
            terminalId: activeTerminalId,
            query,
            caseSensitive: this.caseSensitiveSignal(),
            regularExpression: this.regularExpressionSignal(),
            beginBufferLine: this.beginBufferLineSignal(),
            endBufferLine: this.endBufferLineSignal(),
            cursorBufferLine,
            resultLineLimit: this.resultPageLineLimit,
        });
    }

    private clearDecorationsInAllTerminals(): void {
        this.terminalSearchHostPort.requestSearchDecorationClear();
    }

    private handleSearchResult(terminalSearchResult: {
        terminalId: TerminalSearchTerminalIdContract;
        query: string;
        caseSensitive: boolean;
        regularExpression: boolean;
        beginBufferLine?: number;
        endBufferLine?: number;
        cursorBufferLine?: number;
        hasMore: boolean;
        nextCursorBufferLine?: number;
        lines: ReadonlyArray<TerminalSearchLineResultContract>;
    }): void {
        if (terminalSearchResult.terminalId !== this.activeTerminalIdSignal()) {
            return;
        }

        if (terminalSearchResult.query !== this.searchQuerySignal().trim()) {
            return;
        }

        if (terminalSearchResult.caseSensitive !== this.caseSensitiveSignal()) {
            return;
        }

        if (terminalSearchResult.regularExpression !== this.regularExpressionSignal()) {
            return;
        }

        if (terminalSearchResult.beginBufferLine !== this.beginBufferLineSignal()) {
            return;
        }

        if (terminalSearchResult.endBufferLine !== this.endBufferLineSignal()) {
            return;
        }

        this.hasMoreResultsSignal.set(terminalSearchResult.hasMore);
        this.nextCursorBufferLineSignal.set(terminalSearchResult.nextCursorBufferLine);

        if (terminalSearchResult.cursorBufferLine === undefined) {
            this.searchResultsSignal.set(terminalSearchResult.lines);
            return;
        }

        this.searchResultsSignal.update((currentSearchResults) => {
            return [...currentSearchResults, ...terminalSearchResult.lines];
        });
    }

    private updateSearchColors(matchBackgroundColor?: string, matchBorderColor?: string): void {
        const normalizedMatchBackgroundColor = this.normalizeHexColor(matchBackgroundColor);
        const normalizedMatchBorderColor = this.normalizeHexColor(matchBorderColor);

        this.matchBackgroundColorSignal.set(normalizedMatchBackgroundColor ?? this.defaultMatchBackgroundColor);
        this.matchBorderColorSignal.set(normalizedMatchBorderColor ?? this.defaultMatchBorderColor);
    }

    private normalizeHexColor(colorValue?: string): string | undefined {
        if (colorValue === undefined || colorValue === null || colorValue.trim().length === 0) {
            return undefined;
        }

        if (colorValue.startsWith("#")) {
            return colorValue;
        }

        return `#${colorValue}`;
    }

    private parseBufferLine(value: string): number | undefined {
        const trimmedValue = value.trim();
        if (trimmedValue.length === 0) {
            return undefined;
        }

        const parsedValue = Number.parseInt(trimmedValue, 10);
        if (Number.isNaN(parsedValue) || parsedValue <= 0) {
            return undefined;
        }

        return parsedValue;
    }
}
