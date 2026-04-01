import { computed, DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  TerminalSearchHostPort,
  TerminalSearchLineResultContract,
} from "@cogno/core-api";
import { TextSearchState, TextSearchUseCase } from "@cogno/core-domain";

@Injectable({ providedIn: "root" })
export class TerminalSearchService {
  private readonly searchInputDebounceMilliseconds = 120;
  private readonly resultPageLineLimit = 200;
  private readonly defaultMatchBackgroundColor = "var(--highlight-color-ct2)";
  private readonly defaultMatchBorderColor = "var(--highlight-color)";
  private readonly searchStateSignal = signal<TextSearchState>(TextSearchUseCase.createInitialState());
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
  readonly isBlockSearchActive: Signal<boolean> = computed(() => {
    const searchState = this.searchStateSignal();
    return searchState.beginBufferLine !== undefined || searchState.endBufferLine !== undefined;
  });
  readonly hasMoreResults: Signal<boolean> = computed(() => this.searchStateSignal().hasMoreResults);

  constructor(
    private readonly terminalSearchHostPort: TerminalSearchHostPort,
    private readonly destroyRef: DestroyRef,
  ) {
    this.terminalSearchHostPort.terminalSearchResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((terminalSearchResult) => {
        this.searchStateSignal.set(
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
        this.searchStateSignal.set(
          TextSearchUseCase.applyScopeRequest(this.searchStateSignal(), terminalSearchPanelPayload),
        );
      });
  }

  submitSearchQuery(query: string): void {
    this.searchStateSignal.set(TextSearchUseCase.setQuery(this.searchStateSignal(), query));
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
    this.searchStateSignal.set(TextSearchUseCase.toggleCaseSensitive(this.searchStateSignal()));
    this.repeatSearch();
  }

  toggleRegularExpression(): void {
    this.searchStateSignal.set(TextSearchUseCase.toggleRegularExpression(this.searchStateSignal()));
    this.repeatSearch();
  }

  clearBlockSearch(): void {
    if (!this.isBlockSearchActive()) {
      return;
    }

    this.searchStateSignal.set(TextSearchUseCase.clearSearchScope(this.searchStateSignal()));
    this.repeatSearch();
  }

  revealSearchResult(searchLine: TerminalSearchLineResultContract): void {
    const revealPayload = TextSearchUseCase.buildRevealRequest(this.searchStateSignal(), searchLine);
    if (!revealPayload) {
      return;
    }

    this.terminalSearchHostPort.requestReveal(revealPayload);
  }

  handleSideMenuOpen(): void {
    this.registerKeybindListener();
    const currentQuery = this.searchStateSignal().query;
    if (currentQuery.length > 0) {
      this.searchInActiveTerminal(undefined);
    }
  }

  handleSideMenuClose(): void {
    this.cancelPendingSearch();
    this.unregisterKeybindListener();
    this.clearDecorationsInAllTerminals();
    this.searchStateSignal.set(TextSearchUseCase.clearForCollectionClose());
  }

  private registerKeybindListener(): void {
  }

  private unregisterKeybindListener(): void {
  }

  private scheduleSearch(query: string): void {
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
    const activeTerminalId = this.searchStateSignal().activeTerminalId ?? this.terminalSearchHostPort.getFocusedTerminalId();
    this.searchStateSignal.set(TextSearchUseCase.setActiveCollectionId(this.searchStateSignal(), activeTerminalId));

    const terminalSearchRequest = TextSearchUseCase.createSearchRequest(
      this.searchStateSignal(),
      activeTerminalId,
      cursorBufferLine,
      this.resultPageLineLimit,
    );
    if (!terminalSearchRequest) {
      this.searchStateSignal.set(TextSearchUseCase.applyMissingCollectionResult(this.searchStateSignal()));
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
