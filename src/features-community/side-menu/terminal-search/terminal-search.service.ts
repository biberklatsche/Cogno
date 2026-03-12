import {DestroyRef, Inject, Injectable, Signal, signal} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {
    TerminalSearchHostPortContract,
    TerminalSearchLineResultContract,
    TerminalSearchRevealRequestContract,
    TerminalSearchTerminalIdContract,
    terminalSearchHostPortToken
} from "@cogno/core-sdk";

@Injectable({providedIn: "root"})
export class TerminalSearchService {
    private readonly defaultMatchBackgroundColor = "var(--highlight-color-ct2)";
    private readonly defaultMatchBorderColor = "var(--highlight-color)";
    private readonly searchQuerySignal = signal<string>("");
    private readonly searchResultsSignal = signal<ReadonlyArray<TerminalSearchLineResultContract>>([]);
    private readonly caseSensitiveSignal = signal<boolean>(false);
    private readonly regularExpressionSignal = signal<boolean>(false);
    private readonly matchBackgroundColorSignal = signal<string>(this.defaultMatchBackgroundColor);
    private readonly matchBorderColorSignal = signal<string>(this.defaultMatchBorderColor);
    private readonly activeTerminalIdSignal = signal<TerminalSearchTerminalIdContract | undefined>(undefined);

    readonly searchQuery: Signal<string> = this.searchQuerySignal.asReadonly();
    readonly searchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>> = this.searchResultsSignal.asReadonly();
    readonly caseSensitive: Signal<boolean> = this.caseSensitiveSignal.asReadonly();
    readonly regularExpression: Signal<boolean> = this.regularExpressionSignal.asReadonly();
    readonly matchBackgroundColor: Signal<string> = this.matchBackgroundColorSignal.asReadonly();
    readonly matchBorderColor: Signal<string> = this.matchBorderColorSignal.asReadonly();

    constructor(
        @Inject(terminalSearchHostPortToken)
        private readonly terminalSearchHostPort: TerminalSearchHostPortContract,
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
    }

    submitSearchQuery(query: string): void {
        this.searchQuerySignal.set(query);
        this.searchInActiveTerminal(query);
    }

    repeatSearch(): void {
        this.searchInActiveTerminal(this.searchQuerySignal());
    }

    toggleCaseSensitive(): void {
        this.caseSensitiveSignal.update((isCaseSensitive: boolean) => !isCaseSensitive);
        this.repeatSearch();
    }

    toggleRegularExpression(): void {
        this.regularExpressionSignal.update((isRegularExpressionEnabled: boolean) => !isRegularExpressionEnabled);
        this.repeatSearch();
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
            this.searchInActiveTerminal(currentQuery);
        }
    }

    handleSideMenuClose(): void {
        this.unregisterKeybindListener();
        this.clearDecorationsInAllTerminals();
        this.searchQuerySignal.set("");
        this.searchResultsSignal.set([]);
        this.caseSensitiveSignal.set(false);
        this.regularExpressionSignal.set(false);
        this.activeTerminalIdSignal.set(undefined);
    }

    private registerKeybindListener(): void {
        // handled by host integration layer
    }

    private unregisterKeybindListener(): void {
        // handled by host integration layer
    }

    private searchInActiveTerminal(query: string): void {
        const activeTerminalId = this.terminalSearchHostPort.getFocusedTerminalId();
        this.activeTerminalIdSignal.set(activeTerminalId);

        if (!activeTerminalId) {
            this.searchResultsSignal.set([]);
            return;
        }

        this.terminalSearchHostPort.requestSearch({
            terminalId: activeTerminalId,
            query,
            caseSensitive: this.caseSensitiveSignal(),
            regularExpression: this.regularExpressionSignal(),
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

        this.searchResultsSignal.set(terminalSearchResult.lines);
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
}
