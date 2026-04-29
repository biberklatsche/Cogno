import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { TerminalSearchHostPort, TerminalSearchLineResultContract } from "@cogno/core-api";
import { SelectionDirection, TextSearchState, TextSearchUseCase } from "@cogno/core-domain";
import {
  DirectionalNavigationItem,
  resolveNextNavigationTarget,
} from "../navigation/directional-navigation.engine";

@Injectable({ providedIn: "root" })
export class TerminalSearchService {
  private readonly searchInputDebounceMilliseconds = 120;
  private readonly resultPageLineLimit = 200;
  private readonly defaultMatchBackgroundColor = "var(--highlight-color-ct2)";
  private readonly defaultMatchBorderColor = "var(--highlight-color)";
  private readonly searchStateSignal = signal<TextSearchState>(
    TextSearchUseCase.createInitialState(),
  );
  private readonly selectedSearchResultIdSignal = signal<string | undefined>(undefined);
  private readonly matchBackgroundColorSignal = signal<string>(this.defaultMatchBackgroundColor);
  private readonly matchBorderColorSignal = signal<string>(this.defaultMatchBorderColor);
  private pendingSearchTimeoutHandle?: ReturnType<typeof setTimeout>;
  private navigationItemsProvider?: () => ReadonlyArray<DirectionalNavigationItem<string>>;

  readonly searchQuery: Signal<string> = computed(() => this.searchStateSignal().query);
  readonly searchResults: Signal<ReadonlyArray<TerminalSearchLineResultContract>> = computed(
    () => this.searchStateSignal().results,
  );
  readonly selectedSearchResultId: Signal<string | undefined> =
    this.selectedSearchResultIdSignal.asReadonly();
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
    private readonly terminalSearchHostPort: TerminalSearchHostPort,
    private readonly destroyRef: DestroyRef,
  ) {
    this.terminalSearchHostPort.terminalSearchResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchResult) => {
        this.applySearchState(
          TextSearchUseCase.applySearchResult(this.searchStateSignal(), terminalSearchResult),
        );
      });

    this.terminalSearchHostPort.terminalSearchColorConfig$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchColorConfig) => {
        this.updateSearchColors(
          terminalSearchColorConfig.matchBackgroundColor,
          terminalSearchColorConfig.matchBorderColor,
        );
      });

    this.terminalSearchHostPort.terminalSearchPanelRequest$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchPanelPayload) => {
        this.applySearchState(
          TextSearchUseCase.applyScopeRequest(this.searchStateSignal(), terminalSearchPanelPayload),
        );
      });
  }

  submitSearchQuery(query: string): void {
    this.applySearchState(TextSearchUseCase.setQuery(this.searchStateSignal(), query));
    this.scheduleSearch(query);
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
    this.applySearchState(TextSearchUseCase.toggleCaseSensitive(this.searchStateSignal()));
    this.repeatSearch();
  }

  toggleRegularExpression(): void {
    this.applySearchState(TextSearchUseCase.toggleRegularExpression(this.searchStateSignal()));
    this.repeatSearch();
  }

  clearBlockSearch(): void {
    if (!this.isBlockSearchActive()) {
      return;
    }

    this.applySearchState(TextSearchUseCase.clearSearchScope(this.searchStateSignal()));
    this.repeatSearch();
  }

  revealSearchResult(searchLine: TerminalSearchLineResultContract): void {
    this.selectSearchResult(searchLine);
    const revealPayload = TextSearchUseCase.buildRevealRequest(
      this.searchStateSignal(),
      searchLine,
    );
    if (!revealPayload) {
      return;
    }

    this.terminalSearchHostPort.requestReveal(revealPayload);
  }

  revealSelectedSearchResult(): boolean {
    const selectedSearchResult = this.getSelectedSearchResult();
    if (!selectedSearchResult) {
      return false;
    }

    this.revealSearchResult(selectedSearchResult);
    return true;
  }

  handleNavigationKey(key: string): void {
    if (key === "ArrowDown") {
      this.selectNextSearchResult("down");
      return;
    }
    if (key === "ArrowUp") {
      this.selectNextSearchResult("up");
    }
  }

  registerNavigationItemsProvider(
    provider: () => ReadonlyArray<DirectionalNavigationItem<string>>,
  ): void {
    this.navigationItemsProvider = provider;
  }

  unregisterNavigationItemsProvider(
    provider: () => ReadonlyArray<DirectionalNavigationItem<string>>,
  ): void {
    if (this.navigationItemsProvider === provider) {
      this.navigationItemsProvider = undefined;
    }
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
    this.applySearchState(TextSearchUseCase.clearForCollectionClose());
  }

  private scheduleSearch(_query: string): void {
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
      this.searchStateSignal().activeTerminalId ??
      this.terminalSearchHostPort.getFocusedTerminalId();
    this.applySearchState(
      TextSearchUseCase.setActiveCollectionId(this.searchStateSignal(), activeTerminalId),
    );

    const terminalSearchRequest = TextSearchUseCase.createSearchRequest(
      this.searchStateSignal(),
      activeTerminalId,
      cursorBufferLine,
      this.resultPageLineLimit,
    );
    if (!terminalSearchRequest) {
      this.applySearchState(
        TextSearchUseCase.applyMissingCollectionResult(this.searchStateSignal()),
      );
      return;
    }

    this.terminalSearchHostPort.requestSearch(terminalSearchRequest);
  }

  private clearDecorationsInAllTerminals(): void {
    this.terminalSearchHostPort.requestSearchDecorationClear();
  }

  private updateSearchColors(matchBackgroundColor?: string, matchBorderColor?: string): void {
    const normalizedMatchBackgroundColor = this.normalizeHexColor(matchBackgroundColor);
    const normalizedMatchBorderColor = this.normalizeHexColor(matchBorderColor);

    this.matchBackgroundColorSignal.set(
      normalizedMatchBackgroundColor ?? this.defaultMatchBackgroundColor,
    );
    this.matchBorderColorSignal.set(normalizedMatchBorderColor ?? this.defaultMatchBorderColor);
  }

  private getSelectedSearchResult(): TerminalSearchLineResultContract | undefined {
    const selectedSearchResultId = this.selectedSearchResultIdSignal();
    const searchResults = this.searchStateSignal().results;
    if (selectedSearchResultId) {
      return searchResults.find(
        (searchLine) => this.createSearchResultId(searchLine) === selectedSearchResultId,
      );
    }

    return searchResults.at(-1);
  }

  private selectSearchResult(searchLine: TerminalSearchLineResultContract): void {
    this.selectedSearchResultIdSignal.set(this.createSearchResultId(searchLine));
  }

  private selectNextSearchResult(direction: SelectionDirection): void {
    const nextSearchResultId = resolveNextNavigationTarget({
      items: this.navigationItemsProvider?.() ?? [],
      activeId: this.selectedSearchResultIdSignal() ?? null,
      direction,
      wrap: true,
    });
    if (!nextSearchResultId) {
      return;
    }

    this.selectedSearchResultIdSignal.set(nextSearchResultId);
  }

  private applySearchState(state: TextSearchState): void {
    this.searchStateSignal.set(state);
    this.syncSelectedSearchResult();
  }

  private syncSelectedSearchResult(): void {
    const searchResults = this.searchStateSignal().results;
    if (searchResults.length === 0) {
      this.selectedSearchResultIdSignal.set(undefined);
      return;
    }

    const selectedSearchResultId = this.selectedSearchResultIdSignal();
    if (
      selectedSearchResultId &&
      searchResults.some(
        (searchLine) => this.createSearchResultId(searchLine) === selectedSearchResultId,
      )
    ) {
      return;
    }

    const lastSearchResult = searchResults.at(-1);
    if (!lastSearchResult) {
      this.selectedSearchResultIdSignal.set(undefined);
      return;
    }

    this.selectedSearchResultIdSignal.set(this.createSearchResultId(lastSearchResult));
  }

  private createSearchResultId(searchLine: TerminalSearchLineResultContract): string {
    return `${searchLine.lineNumber}:${searchLine.lineText}`;
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
