import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TerminalSearchApi } from "@cogno/core/api/terminal-search-api";
import {
  TerminalSearchLineResultContract,
  TerminalSearchResultContract,
} from "@cogno/shared/domain";
import {
  buildRevealRequest,
  createSearchResultId,
  initialTerminalSearchState,
  isAnswerToCurrentSearch,
  TerminalSearchState,
} from "./terminal-search-state";

@Injectable({ providedIn: "root" })
export class TerminalSearchService {
  private readonly searchInputDebounceMilliseconds = 120;
  private readonly resultPageLineLimit = 200;
  private readonly defaultMatchBackgroundColor =
    "color-mix(in srgb, var(--highlight-color) var(--menu-opacity-ct2), transparent)";
  private readonly defaultMatchBorderColor = "var(--highlight-color)";
  private readonly searchStateSignal = signal<TerminalSearchState>(initialTerminalSearchState);
  private readonly explicitlySelectedSearchResultIdSignal = signal<string | undefined>(undefined);
  private readonly matchBackgroundColorSignal = signal<string>(this.defaultMatchBackgroundColor);
  private readonly matchBorderColorSignal = signal<string>(this.defaultMatchBorderColor);
  private pendingSearchTimeoutHandle?: ReturnType<typeof setTimeout>;

  readonly searchQuery: Signal<string> = computed(() => this.searchStateSignal().query);
  readonly searchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>> = computed(
    () => this.searchStateSignal().results,
  );
  /** The explicitly selected result while the list still has it, else the last one. */
  readonly selectedSearchResultId: Signal<string | undefined> = computed(() => {
    const searchResultIds = this.searchResults().map(createSearchResultId);
    const explicitlySelectedSearchResultId = this.explicitlySelectedSearchResultIdSignal();
    return explicitlySelectedSearchResultId !== undefined &&
      searchResultIds.includes(explicitlySelectedSearchResultId)
      ? explicitlySelectedSearchResultId
      : searchResultIds.at(-1);
  });
  readonly caseSensitive: Signal<boolean> = computed(() => this.searchStateSignal().caseSensitive);
  readonly regularExpression: Signal<boolean> = computed(
    () => this.searchStateSignal().regularExpression,
  );
  readonly matchBackgroundColor: Signal<string> = this.matchBackgroundColorSignal.asReadonly();
  readonly matchBorderColor: Signal<string> = this.matchBorderColorSignal.asReadonly();
  readonly beginBufferLine: Signal<number | undefined> = computed(
    () => this.searchStateSignal().beginBufferLine,
  );
  readonly endBufferLine: Signal<number | undefined> = computed(
    () => this.searchStateSignal().endBufferLine,
  );
  readonly isBlockSearchActive: Signal<boolean> = computed(() => {
    const searchState = this.searchStateSignal();
    return searchState.beginBufferLine !== undefined || searchState.endBufferLine !== undefined;
  });
  readonly hasMoreResults: Signal<boolean> = computed(
    () => this.searchStateSignal().hasMoreResults,
  );

  constructor(
    private readonly terminalSearchApi: TerminalSearchApi,
    private readonly destroyRef: DestroyRef,
  ) {
    this.terminalSearchApi.terminalSearchResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchResult) => this.applySearchResult(terminalSearchResult));

    this.terminalSearchApi.terminalSearchColorConfig$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchColorConfig) => {
        this.updateSearchColors(
          terminalSearchColorConfig.matchBackgroundColor,
          terminalSearchColorConfig.matchBorderColor,
        );
      });

    this.terminalSearchApi.terminalSearchPanelRequest$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchPanelPayload) => {
        this.patchSearchState({
          activeTerminalId: terminalSearchPanelPayload.terminalId,
          beginBufferLine: terminalSearchPanelPayload.beginBufferLine,
          endBufferLine: terminalSearchPanelPayload.endBufferLine,
        });
        this.showSearchResults([], false, undefined);
      });
  }

  submitSearchQuery(query: string): void {
    this.patchSearchState({ query });
    this.scheduleSearch();
  }

  repeatSearch(): void {
    this.cancelPendingSearch();
    this.searchInActiveTerminal(undefined);
  }

  loadMoreSearchResults(): void {
    const nextCursorBufferLine = this.searchStateSignal().nextCursorBufferLine;
    if (nextCursorBufferLine === undefined) {
      return;
    }

    this.cancelPendingSearch();
    this.searchInActiveTerminal(nextCursorBufferLine);
  }

  toggleCaseSensitive(): void {
    this.patchSearchState({ caseSensitive: !this.caseSensitive() });
    this.repeatSearch();
  }

  toggleRegularExpression(): void {
    this.patchSearchState({ regularExpression: !this.regularExpression() });
    this.repeatSearch();
  }

  clearBlockSearch(): void {
    if (!this.isBlockSearchActive()) {
      return;
    }

    this.patchSearchState({ beginBufferLine: undefined, endBufferLine: undefined });
    this.repeatSearch();
  }

  revealSearchResult(searchLine: TerminalSearchLineResultContract): void {
    this.explicitlySelectedSearchResultIdSignal.set(createSearchResultId(searchLine));
    const revealPayload = buildRevealRequest(this.searchStateSignal(), searchLine);
    if (!revealPayload) {
      return;
    }

    this.terminalSearchApi.requestReveal(revealPayload);
  }

  revealSelectedSearchResult(): boolean {
    const selectedSearchResultId = this.selectedSearchResultId();
    const selectedSearchResult = this.searchResults().find(
      (searchLine) => createSearchResultId(searchLine) === selectedSearchResultId,
    );
    if (!selectedSearchResult) {
      return false;
    }

    this.revealSearchResult(selectedSearchResult);
    return true;
  }

  /**
   * Moves the selection one row down (1) or up (-1), wrapping around at both
   * ends. The panel lists the results last-first, so a row down is a result back.
   */
  move(delta: 1 | -1): void {
    const searchResultIds = this.searchResults().map(createSearchResultId);
    const selectedSearchResultId = this.selectedSearchResultId();
    if (selectedSearchResultId === undefined) {
      return;
    }

    const selectedIndex = searchResultIds.indexOf(selectedSearchResultId);
    const nextIndex = (selectedIndex - delta + searchResultIds.length) % searchResultIds.length;
    this.explicitlySelectedSearchResultIdSignal.set(searchResultIds[nextIndex]);
  }

  handleSideMenuOpen(): void {
    const currentQuery = this.searchStateSignal().query;
    if (currentQuery.length > 0) {
      this.searchInActiveTerminal(undefined);
    }
  }

  handleSideMenuClose(): void {
    this.cancelPendingSearch();
    this.clearDecorationsInAllTerminals();
    this.searchStateSignal.set(initialTerminalSearchState);
    this.explicitlySelectedSearchResultIdSignal.set(undefined);
  }

  private scheduleSearch(): void {
    this.cancelPendingSearch();
    this.pendingSearchTimeoutHandle = setTimeout(() => {
      this.pendingSearchTimeoutHandle = undefined;
      this.searchInActiveTerminal(undefined);
    }, this.searchInputDebounceMilliseconds);
  }

  private cancelPendingSearch(): void {
    if (this.pendingSearchTimeoutHandle === undefined) {
      return;
    }

    clearTimeout(this.pendingSearchTimeoutHandle);
    this.pendingSearchTimeoutHandle = undefined;
  }

  private searchInActiveTerminal(cursorBufferLine: number | undefined): void {
    const activeTerminalId =
      this.searchStateSignal().activeTerminalId ?? this.terminalSearchApi.getFocusedTerminalId();
    this.patchSearchState({ activeTerminalId });
    if (!activeTerminalId) {
      this.showSearchResults([], false, undefined);
      return;
    }

    const searchState = this.searchStateSignal();
    this.terminalSearchApi.requestSearch({
      terminalId: activeTerminalId,
      query: searchState.query,
      caseSensitive: searchState.caseSensitive,
      regularExpression: searchState.regularExpression,
      beginBufferLine: searchState.beginBufferLine,
      endBufferLine: searchState.endBufferLine,
      cursorBufferLine,
      resultLineLimit: this.resultPageLineLimit,
    });
  }

  private applySearchResult(terminalSearchResult: TerminalSearchResultContract): void {
    if (!isAnswerToCurrentSearch(this.searchStateSignal(), terminalSearchResult)) {
      return;
    }

    // An answer to a cursor request is the next page; any other one is a new list.
    const isNextPage = terminalSearchResult.cursorBufferLine !== undefined;
    this.showSearchResults(
      isNextPage
        ? [...this.searchResults(), ...terminalSearchResult.lines]
        : terminalSearchResult.lines,
      terminalSearchResult.hasMore,
      terminalSearchResult.nextCursorBufferLine,
    );
  }

  private clearDecorationsInAllTerminals(): void {
    this.terminalSearchApi.requestSearchDecorationClear();
  }

  private updateSearchColors(matchBackgroundColor?: string, matchBorderColor?: string): void {
    const normalizedMatchBackgroundColor = this.normalizeHexColor(matchBackgroundColor);
    const normalizedMatchBorderColor = this.normalizeHexColor(matchBorderColor);

    this.matchBackgroundColorSignal.set(
      normalizedMatchBackgroundColor ?? this.defaultMatchBackgroundColor,
    );
    this.matchBorderColorSignal.set(normalizedMatchBorderColor ?? this.defaultMatchBorderColor);
  }

  private showSearchResults(
    results: ReadonlyArray<TerminalSearchLineResultContract>,
    hasMoreResults: boolean,
    nextCursorBufferLine: number | undefined,
  ): void {
    // Pin the current selection first: it stays while the new list still has it. That
    // includes the default selection, which would otherwise jump to the end of an
    // appended page.
    this.explicitlySelectedSearchResultIdSignal.set(this.selectedSearchResultId());
    this.patchSearchState({ results, hasMoreResults, nextCursorBufferLine });
  }

  private patchSearchState(change: Partial<TerminalSearchState>): void {
    this.searchStateSignal.update((searchState) => ({ ...searchState, ...change }));
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
