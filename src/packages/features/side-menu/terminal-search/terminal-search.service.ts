import {computed, DestroyRef, Inject, Injectable, Signal, signal} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {
    TerminalSearchHostPortContract,
    TerminalSearchLineResultContract,
    TerminalSearchRevealRequestContract,
    TerminalSearchTerminalIdContract,
    terminalSearchHostPortToken
} from "@cogno/core-sdk";
import { AppBus } from "@cogno/app/app-bus/app-bus";

type TerminalSearchState = {
    query: string;
    results: ReadonlyArray<TerminalSearchLineResultContract>;
    caseSensitive: boolean;
    regularExpression: boolean;
    activeTerminalId?: TerminalSearchTerminalIdContract;
    beginBufferLine?: number;
    endBufferLine?: number;
    hasMoreResults: boolean;
    nextCursorBufferLine?: number;
};

@Injectable({providedIn: "root"})
export class TerminalSearchService {
    private readonly searchInputDebounceMilliseconds = 120;
    private readonly resultPageLineLimit = 200;
    private readonly defaultMatchBackgroundColor = "var(--highlight-color-ct2)";
    private readonly defaultMatchBorderColor = "var(--highlight-color)";
    private readonly searchStateSignal = signal<TerminalSearchState>(this.createInitialSearchState());
    private readonly matchBackgroundColorSignal = signal<string>(this.defaultMatchBackgroundColor);
    private readonly matchBorderColorSignal = signal<string>(this.defaultMatchBorderColor);
    private pendingSearchTimeoutHandle?: ReturnType<typeof setTimeout>;

    readonly searchQuery: Signal<string> = computed(() => this.searchStateSignal().query);
    readonly searchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>> = computed(() => this.searchStateSignal().results);
    readonly caseSensitive: Signal<boolean> = computed(() => this.searchStateSignal().caseSensitive);
    readonly regularExpression: Signal<boolean> = computed(() => this.searchStateSignal().regularExpression);
    readonly matchBackgroundColor: Signal<string> = this.matchBackgroundColorSignal.asReadonly();
    readonly matchBorderColor: Signal<string> = this.matchBorderColorSignal.asReadonly();
    readonly beginBufferLine: Signal<number | undefined> = computed(() => this.searchStateSignal().beginBufferLine);
    readonly endBufferLine: Signal<number | undefined> = computed(() => this.searchStateSignal().endBufferLine);
    readonly hasMoreResults: Signal<boolean> = computed(() => this.searchStateSignal().hasMoreResults);

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

                this.applyPanelRequest(
                    terminalSearchPanelPayload.terminalId,
                    terminalSearchPanelPayload.beginBufferLine,
                    terminalSearchPanelPayload.endBufferLine,
                );
            });
    }

    submitSearchQuery(query: string): void {
        this.updateSearchState({
            query,
        });
        this.scheduleSearch(query);
    }

    repeatSearch(): void {
        this.cancelPendingSearch();
        this.searchInActiveTerminal(this.searchStateSignal().query, undefined);
    }

    loadMoreSearchResults(): void {
        const nextCursorBufferLine = this.searchStateSignal().nextCursorBufferLine;
        if (nextCursorBufferLine === undefined) {
            return;
        }

        this.cancelPendingSearch();
        this.searchInActiveTerminal(this.searchStateSignal().query, nextCursorBufferLine);
    }

    toggleCaseSensitive(): void {
        this.updateSearchState({
            caseSensitive: !this.searchStateSignal().caseSensitive,
        });
        this.repeatSearch();
    }

    toggleRegularExpression(): void {
        this.updateSearchState({
            regularExpression: !this.searchStateSignal().regularExpression,
        });
        this.repeatSearch();
    }

    updateBeginBufferLine(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.updateSearchState({
            beginBufferLine: this.parseBufferLine(inputElement.value),
        });
        this.scheduleSearch(this.searchStateSignal().query);
    }

    updateEndBufferLine(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.updateSearchState({
            endBufferLine: this.parseBufferLine(inputElement.value),
        });
        this.scheduleSearch(this.searchStateSignal().query);
    }

    revealSearchResult(searchLine: TerminalSearchLineResultContract): void {
        const activeTerminalId = this.searchStateSignal().activeTerminalId;
        if (!activeTerminalId) {
            return;
        }

        const firstLineMatch = searchLine.matches.at(0);
        if (!firstLineMatch) {
            return;
        }

        const revealPayload: TerminalSearchRevealRequestContract = {
            terminalId: activeTerminalId,
            query: this.searchStateSignal().query.trim(),
            caseSensitive: this.searchStateSignal().caseSensitive,
            regularExpression: this.searchStateSignal().regularExpression,
            lineNumber: searchLine.lineNumber,
            matchStartIndex: firstLineMatch.startIndex,
            matchLength: firstLineMatch.endIndex - firstLineMatch.startIndex,
        };

        this.terminalSearchHostPort.requestReveal(revealPayload);
    }

    handleSideMenuOpen(): void {
        this.registerKeybindListener();
        const currentQuery = this.searchStateSignal().query;
        if (currentQuery.length > 0) {
            this.searchInActiveTerminal(currentQuery, undefined);
        }
    }

    handleSideMenuClose(): void {
        this.cancelPendingSearch();
        this.unregisterKeybindListener();
        this.clearDecorationsInAllTerminals();
        this.searchStateSignal.set(this.createInitialSearchState());
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
        const activeTerminalId = this.searchStateSignal().activeTerminalId ?? this.terminalSearchHostPort.getFocusedTerminalId();
        this.updateSearchState({
            activeTerminalId,
        });

        if (!activeTerminalId) {
            this.updateSearchState({
                results: [],
                hasMoreResults: false,
                nextCursorBufferLine: undefined,
            });
            return;
        }

        const searchState = this.searchStateSignal();
        this.terminalSearchHostPort.requestSearch({
            terminalId: activeTerminalId,
            query,
            caseSensitive: searchState.caseSensitive,
            regularExpression: searchState.regularExpression,
            beginBufferLine: searchState.beginBufferLine,
            endBufferLine: searchState.endBufferLine,
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
        const searchState = this.searchStateSignal();
        if (terminalSearchResult.terminalId !== searchState.activeTerminalId) {
            return;
        }

        if (terminalSearchResult.query !== searchState.query.trim()) {
            return;
        }

        if (terminalSearchResult.caseSensitive !== searchState.caseSensitive) {
            return;
        }

        if (terminalSearchResult.regularExpression !== searchState.regularExpression) {
            return;
        }

        if (terminalSearchResult.beginBufferLine !== searchState.beginBufferLine) {
            return;
        }

        if (terminalSearchResult.endBufferLine !== searchState.endBufferLine) {
            return;
        }

        if (terminalSearchResult.cursorBufferLine === undefined) {
            this.applySearchResultPage(terminalSearchResult.lines, terminalSearchResult.hasMore, terminalSearchResult.nextCursorBufferLine, false);
            return;
        }

        this.applySearchResultPage(terminalSearchResult.lines, terminalSearchResult.hasMore, terminalSearchResult.nextCursorBufferLine, true);
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

    private applyPanelRequest(
        activeTerminalId: TerminalSearchTerminalIdContract | undefined,
        beginBufferLine: number | undefined,
        endBufferLine: number | undefined,
    ): void {
        this.updateSearchState({
            activeTerminalId,
            beginBufferLine,
            endBufferLine,
            results: [],
            hasMoreResults: false,
            nextCursorBufferLine: undefined,
        });
    }

    private applySearchResultPage(
        lines: ReadonlyArray<TerminalSearchLineResultContract>,
        hasMoreResults: boolean,
        nextCursorBufferLine: number | undefined,
        appendResults: boolean,
    ): void {
        const nextResults = appendResults
            ? [...this.searchStateSignal().results, ...lines]
            : [...lines];

        this.updateSearchState({
            results: nextResults,
            hasMoreResults,
            nextCursorBufferLine,
        });
    }

    private updateSearchState(searchStateUpdates: Partial<TerminalSearchState>): void {
        this.searchStateSignal.update((searchState) => ({
            ...searchState,
            ...searchStateUpdates,
        }));
    }

    private createInitialSearchState(): TerminalSearchState {
        return {
            query: "",
            results: [],
            caseSensitive: false,
            regularExpression: false,
            activeTerminalId: undefined,
            beginBufferLine: undefined,
            endBufferLine: undefined,
            hasMoreResults: false,
            nextCursorBufferLine: undefined,
        };
    }
}
