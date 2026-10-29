import { Injectable, OnDestroy } from "@angular/core";
import { SessionCommandLog } from "@cogno/core/session/command-log/session-command-log";
import {
  DROPDOWN_PANEL_MIN_WIDTH,
  DropdownPosition,
  inputSignature,
  positionDropdownPanel,
} from "@cogno/core/session/dropdown/dropdown-panel-positioning";
import { TerminalDropdownCoordinatorService } from "@cogno/core/session/dropdown/terminal-dropdown-coordinator.service";
import { SessionHost, SessionState } from "@cogno/core/session/host/session-host";
import { BehaviorSubject, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { AutocompleteSuggestion, AutocompleteViewState, QueryContext } from "./autocomplete.types";
import { AutocompleteContextParser } from "./autocomplete-context.parser";
import { SharedSuggestors } from "./shared-suggestors";
import { SuggestionCollapser } from "./suggestion-collapser";
import { SuggestionHighlighter } from "./suggestion-highlighter";
import { isHistorySource } from "./suggestion-source";
import { TerminalAutocompleteSuggestorContract } from "./suggestor.contracts";
import { CommandPatternSuggestor } from "./suggestors/command-pattern.suggestor";
import { HistoryCommandSuggestor } from "./suggestors/history-command.suggestor";
import { HistoryDirectorySuggestor } from "./suggestors/history-directory.suggestor";
import { TerminalAutocompleteSuggestor } from "./suggestors/terminal-autocomplete.suggestor";
import { AutocompleteTimeoutError, withTimeout } from "./with-timeout";

const REFRESH_DEBOUNCE_MS = 80;
const SUGGESTOR_TIMEOUT_MS = 180;
const MAX_SUGGESTIONS = 100;
const MAX_TOP_HISTORY_SUGGESTIONS = 3;
const SUGGESTOR_ISSUE_NOTIFICATION_THROTTLE_MS = 10_000;

const PANEL_ITEM_HORIZONTAL_PADDING = 16; // 8px left + 8px right
const PANEL_ITEM_GAP = 8;
const LABEL_MEASURE_MAX_CHARS = 140;
const PANEL_LIST_EXTRA_PX = 8;
const PANEL_DESCRIPTION_MIN_PX = 30;
export type SuggestionFilterMode = "all" | "history-only" | "context-only";
const FILTER_MODE_STORAGE_KEY = "terminal.autocomplete.filterMode";

export const INITIAL_VIEW_STATE: AutocompleteViewState = {
  visible: false,
  x: 0,
  y: 0,
  width: DROPDOWN_PANEL_MIN_WIDTH,
  placement: "below",
  selectedIndex: null,
  suggestions: [],
};

@Injectable()
export class TerminalAutocompleteService implements OnDestroy {
  private readonly suggestionHighlighter = new SuggestionHighlighter();
  private readonly suggestionCollapser = new SuggestionCollapser();

  private readonly _viewState = new BehaviorSubject<AutocompleteViewState>(INITIAL_VIEW_STATE);
  private readonly _subscription = new Subscription();
  private _suggestors: TerminalAutocompleteSuggestorContract[] = [];
  private _activeRequestId = 0;
  private _suppressNextRefresh = false;
  private _suppressUntilTyping = false;
  private readonly _keydownHandler: (event: KeyboardEvent) => void;
  private _hostElement?: HTMLElement;
  private _lastInputSignature: string;
  private _manualTriggerInputSignature?: string;
  private readonly _filterMode = new BehaviorSubject<SuggestionFilterMode>("all");
  private _latestSuggestions: AutocompleteSuggestion[] = [];
  private _latestContext: QueryContext | null = null;
  private readonly _lastSuggestorIssueNotificationAt = new Map<string, number>();
  private readonly _runningSuggestors = new Map<string, Promise<AutocompleteSuggestion[]>>();

  get viewState$() {
    return this._viewState.asObservable();
  }

  get filterMode$() {
    return this._filterMode.asObservable();
  }

  constructor(
    private readonly host: SessionHost,
    private readonly commandLog: SessionCommandLog,
    private readonly sharedSuggestors: SharedSuggestors,
    private readonly dropdownCoordinator: TerminalDropdownCoordinatorService,
  ) {
    this._filterMode.next(this.loadFilterMode());
    this._lastInputSignature = inputSignature(this.host.state);
    this.registerDefaultSuggestors();
    this.subscribeStateChanges();

    this._keydownHandler = (event: KeyboardEvent) => this.handleSuppressKeydown(event);
    window.addEventListener("keydown", this._keydownHandler, { capture: true });
  }

  ngOnDestroy(): void {
    this.dropdownCoordinator.release(this);
    this._subscription.unsubscribe();
    window.removeEventListener("keydown", this._keydownHandler, { capture: true });
  }

  setHostElement(element: HTMLElement): void {
    this._hostElement = element;
  }

  registerSuggestor(suggestor: TerminalAutocompleteSuggestor): void {
    if (this._suggestors.find((s) => s.id === suggestor.id)) return;
    this._suggestors.push(suggestor);
  }

  setSelectedIndex(index: number): void {
    const view = this._viewState.value;
    if (index < 0 || index >= view.suggestions.length) return;
    this._viewState.next({ ...view, selectedIndex: index });
  }

  private registerDefaultSuggestors(): void {
    this.registerSuggestor(new HistoryDirectorySuggestor(this.commandLog));
    this.registerSuggestor(new CommandPatternSuggestor(this.commandLog));
    this.registerSuggestor(new HistoryCommandSuggestor(this.commandLog));
    this.registerSuggestor(this.sharedSuggestors.specCommand);
  }

  private subscribeStateChanges(): void {
    this._subscription.add(
      this.host.state$.pipe(debounceTime(REFRESH_DEBOUNCE_MS)).subscribe((terminalState) => {
        const viewState = this._viewState.value;
        const currentInputSignature = inputSignature(terminalState);
        if (
          this._manualTriggerInputSignature !== undefined &&
          currentInputSignature !== this._manualTriggerInputSignature
        ) {
          this._manualTriggerInputSignature = undefined;
        }
        if (!this.hasInputChanged(terminalState)) {
          if (viewState.visible && (!terminalState.isFocused || terminalState.isCommandRunning)) {
            this.hide();
          }
          return;
        }
        this._viewState.next({ ...viewState, selectedIndex: null });
        this._lastInputSignature = inputSignature(terminalState);
        void this.refreshSuggestions(terminalState);
      }),
    );
  }

  /** Shows the suggestions on request; true when they are showing afterwards. */
  async triggerAutocomplete(): Promise<boolean> {
    if (!this.host.isFocused) {
      return false;
    }

    this._suppressUntilTyping = false;
    this._manualTriggerInputSignature = inputSignature(this.host.state);
    await this.showSuggestions(this.host.state, true);
    return this._viewState.value.visible;
  }

  /** Cycles the filter mode while the suggestions are showing; true when it did. */
  cycleTab(): boolean {
    if (!this._viewState.value.visible) return false;
    this.cycleFilterMode();
    return true;
  }

  // Called by the coordinator's single global listener when this service is the active owner.
  dispatchKeydown(event: KeyboardEvent): void {
    if (!this.host.isFocused) return;

    const view = this._viewState.value;
    if (!view.visible) return;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        event.stopPropagation();
        const next =
          view.selectedIndex === null ? 0 : (view.selectedIndex + 1) % view.suggestions.length;
        this.setSelectedIndex(next);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        event.stopPropagation();
        const next =
          view.selectedIndex === null
            ? view.suggestions.length - 1
            : view.selectedIndex <= 0
              ? view.suggestions.length - 1
              : view.selectedIndex - 1;
        this.setSelectedIndex(next);
        return;
      }
      case "Enter": {
        if (view.selectedIndex === null) {
          if (event.key === "Enter") {
            this.hide();
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.applySelectedSuggestion(view.selectedIndex);
        return;
      }
      case "Escape": {
        event.preventDefault();
        event.stopPropagation();
        this.hide();
        return;
      }
      default:
        return;
    }
  }

  // Lightweight per-instance listener for suppress-until-typing tracking (runs even when not visible).
  private handleSuppressKeydown(event: KeyboardEvent): void {
    if (!this.host.isFocused) return;
    if (this._viewState.value.visible) return; // handled by coordinator

    if (this.isArrowKey(event.key)) {
      this._suppressUntilTyping = true;
    } else if (this.isTypingKey(event)) {
      this._suppressUntilTyping = false;
    }
  }

  private async refreshSuggestions(state: SessionState): Promise<void> {
    if (this._suppressUntilTyping) {
      this.hide();
      return;
    }
    if (inputSignature(state) === this._manualTriggerInputSignature) {
      return;
    }
    await this.showSuggestions(state, false);
  }

  private async showSuggestions(state: SessionState, allowEmptyInput: boolean): Promise<void> {
    if (this.shouldHideForState(state)) return;

    const context = this.resolveQueryContext(state, allowEmptyInput);
    if (!context) {
      this.hide();
      return;
    }

    const suggestors = this._suggestors.filter((s) => this.suggestorMatches(s, context));
    if (suggestors.length === 0) {
      this.hide();
      return;
    }

    const requestId = ++this._activeRequestId;
    const settled = await this.runSuggestors(suggestors, context);
    if (requestId !== this._activeRequestId) {
      return;
    }

    const ranked = this.rankSuggestions(settled, state);
    const suggestions = this.suggestionCollapser.collapse(
      ranked,
      context.mode === "command" ? context.query : "",
    );
    this._latestSuggestions = suggestions;
    this._latestContext = context;

    const visibleSuggestions = this.suggestionHighlighter.apply(
      this.applyFilterMode(suggestions, this._filterMode.value),
      context,
    );
    if (visibleSuggestions.length === 0) {
      this.hide();
      return;
    }

    const position = this.computePanelPosition(
      state,
      visibleSuggestions,
      this.readRenderedPanelHeight(),
    );
    this.dropdownCoordinator.claim(this);

    this._viewState.next({
      visible: true,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
      selectedIndex: null,
      suggestions: visibleSuggestions,
    });
    queueMicrotask(() => this.repositionUsingRenderedPanelHeight());
  }

  private resolveQueryContext(
    state: SessionState,
    allowEmptyInput: boolean,
  ): QueryContext | undefined {
    const parsedContext = AutocompleteContextParser.parse(state);
    if (parsedContext) {
      return parsedContext;
    }

    if (!allowEmptyInput) {
      return undefined;
    }

    const inputText = state.input.text;
    const cursorIndex = state.input.cursorIndex;
    const beforeCursor = inputText.padEnd(cursorIndex, " ").slice(0, cursorIndex);
    if (beforeCursor.trim().length > 0) {
      return undefined;
    }

    return {
      mode: "command",
      beforeCursor,
      inputText,
      cursorIndex,
      replaceStart: 0,
      replaceEnd: cursorIndex,
      cwd: state.cwd,
      shellContext: state.shellContext,
      query: "",
    };
  }

  private shouldHideForState(state: SessionState): boolean {
    if (!state.isFocused || state.isCommandRunning) {
      this.hide();
      return true;
    }
    if (this._suppressNextRefresh) {
      this._suppressNextRefresh = false;
      this.hide();
      return true;
    }
    return false;
  }

  private async runSuggestors(
    suggestors: TerminalAutocompleteSuggestor[],
    context: QueryContext,
  ): Promise<AutocompleteSuggestion[][]> {
    return Promise.all(suggestors.map((suggestor) => this.runSuggestor(suggestor, context)));
  }

  private async runSuggestor(
    suggestor: TerminalAutocompleteSuggestor,
    context: QueryContext,
  ): Promise<AutocompleteSuggestion[]> {
    if (this._runningSuggestors.has(suggestor.id)) {
      return [];
    }

    const suggestionsPromise = suggestor.suggest(context);
    this._runningSuggestors.set(suggestor.id, suggestionsPromise);
    const release = () => {
      if (this._runningSuggestors.get(suggestor.id) === suggestionsPromise) {
        this._runningSuggestors.delete(suggestor.id);
      }
    };
    void suggestionsPromise.then(release, release);

    try {
      return await withTimeout(suggestionsPromise, SUGGESTOR_TIMEOUT_MS);
    } catch (reason) {
      if (!(reason instanceof AutocompleteTimeoutError)) {
        this.notifySuggestorIssue(suggestor, reason, context);
      }
      return [];
    }
  }

  private rankSuggestions(
    settled: AutocompleteSuggestion[][],
    state: SessionState,
  ): AutocompleteSuggestion[] {
    return settled
      .flat()
      .filter((s) => !this.suggestionEqualsCurrentInput(s, state.input.text))
      .sort((a, b) => b.score - a.score);
  }

  private prioritizeHistorySuggestions(items: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    const history = items.filter((item) => isHistorySource(item.source));
    const reservedHistory = history.slice(0, MAX_TOP_HISTORY_SUGGESTIONS);
    const used = new Set(reservedHistory);
    const nonHistory = items.filter((item) => !isHistorySource(item.source));
    const additionalHistory = history.filter((item) => !used.has(item));

    return [...reservedHistory, ...nonHistory, ...additionalHistory];
  }

  private applyFilterMode(
    items: AutocompleteSuggestion[],
    mode: SuggestionFilterMode,
  ): AutocompleteSuggestion[] {
    if (mode === "history-only") {
      return items.filter((item) => isHistorySource(item.source)).slice(0, MAX_SUGGESTIONS);
    }
    if (mode === "context-only") {
      return items.filter((item) => !isHistorySource(item.source)).slice(0, MAX_SUGGESTIONS);
    }
    return this.prioritizeHistorySuggestions(this.dedupeSuggestions(items)).slice(
      0,
      MAX_SUGGESTIONS,
    );
  }

  private applySelectedSuggestion(index: number): void {
    const view = this._viewState.value;
    const suggestion = view.suggestions[index];
    if (!suggestion) return;

    const input = this.host.input;
    const paddedInputText = input.text.padEnd(
      Math.max(input.text.length, suggestion.replaceEnd),
      " ",
    );
    const start = Math.max(0, Math.min(suggestion.replaceStart, paddedInputText.length));
    const end = Math.max(start, Math.min(suggestion.replaceEnd, paddedInputText.length));
    const inputText =
      paddedInputText.slice(0, start) + suggestion.insertText + paddedInputText.slice(end);
    const cursorIndex = start + suggestion.insertText.length;

    if (suggestion.selectedPath) {
      this.commandLog.markDirectorySelected(suggestion.selectedPath);
    }
    if (suggestion.selectedCommand && this.host.state.cwd) {
      this.commandLog.markCommandSelected(suggestion.selectedCommand, this.host.state.cwd);
    }
    if (suggestion.selectedPatternSignature) {
      this.commandLog.markCommandPatternSelected(suggestion.selectedPatternSignature);
    }
    if (suggestion.liveCollapsedFrom && suggestion.liveCollapsedFrom.length > 0) {
      this.commandLog.confirmLivePattern(suggestion.liveCollapsedFrom);
    }
    this.host.replaceInput(inputText, cursorIndex);

    this._suppressNextRefresh = this.shouldSuppressRefreshAfterSelection(suggestion);
    this.hide();
  }

  private computePanelPosition(
    state: SessionState,
    suggestions: AutocompleteSuggestion[],
    measuredPanelHeight: number | null,
  ): DropdownPosition {
    return positionDropdownPanel({
      state,
      hostRect: this._hostElement?.getBoundingClientRect(),
      items: suggestions,
      itemWidthPx: (item, labelCharPx) => {
        const metaCharPx = Math.max(6, Math.floor(labelCharPx * 0.9));
        const metaText = `${item.source} · ${item.score}`;
        return (
          Math.min(item.label.length, LABEL_MEASURE_MAX_CHARS) * labelCharPx +
          PANEL_ITEM_GAP +
          metaText.length * metaCharPx +
          PANEL_ITEM_HORIZONTAL_PADDING
        );
      },
      footerPx: PANEL_LIST_EXTRA_PX + PANEL_DESCRIPTION_MIN_PX,
      measuredPanelHeight,
    });
  }

  private repositionUsingRenderedPanelHeight(): void {
    const view = this._viewState.value;
    if (!view.visible) return;

    const measuredPanelHeight = this.readRenderedPanelHeight();
    if (measuredPanelHeight === null) return;

    const position = this.computePanelPosition(
      this.host.state,
      view.suggestions,
      measuredPanelHeight,
    );
    if (
      position.x === view.x &&
      position.y === view.y &&
      position.width === view.width &&
      position.placement === view.placement
    ) {
      return;
    }

    this._viewState.next({
      ...view,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
    });
  }

  private readRenderedPanelHeight(): number | null {
    const panelElement = document.querySelector<HTMLElement>(".autocomplete-panel");
    if (!panelElement) return null;

    const renderedPanelHeight = panelElement.getBoundingClientRect().height;
    if (renderedPanelHeight <= 0) return null;
    return renderedPanelHeight;
  }

  private dedupeSuggestions(items: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    const map = new Map<string, { suggestion: AutocompleteSuggestion; sources: Set<string> }>();
    for (const item of items) {
      const key = `${item.label.toLowerCase()}:${item.replaceStart}:${item.replaceEnd}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          suggestion: { ...item },
          sources: new Set([item.source]),
        });
        continue;
      }

      existing.sources.add(item.source);

      if (item.score > existing.suggestion.score) {
        existing.suggestion = {
          ...item,
          source: existing.suggestion.source,
          score: item.score,
          description: item.description ?? existing.suggestion.description,
          selectedPath: item.selectedPath ?? existing.suggestion.selectedPath,
          selectedCommand: item.selectedCommand ?? existing.suggestion.selectedCommand,
          selectedPatternSignature:
            item.selectedPatternSignature ?? existing.suggestion.selectedPatternSignature,
        };
      } else {
        if (!existing.suggestion.description && item.description) {
          existing.suggestion.description = item.description;
        }
        if (!existing.suggestion.selectedPath && item.selectedPath) {
          existing.suggestion.selectedPath = item.selectedPath;
        }
        if (!existing.suggestion.selectedCommand && item.selectedCommand) {
          existing.suggestion.selectedCommand = item.selectedCommand;
        }
        if (!existing.suggestion.selectedPatternSignature && item.selectedPatternSignature) {
          existing.suggestion.selectedPatternSignature = item.selectedPatternSignature;
        }
      }
    }

    return [...map.values()].map((entry) => {
      const sources = [...entry.sources].sort();
      const sourceBonus = Math.max(0, sources.length - 1) * 8;
      return {
        ...entry.suggestion,
        source: sources.join(" + "),
        score: entry.suggestion.score + sourceBonus,
      };
    });
  }

  private suggestionEqualsCurrentInput(
    suggestion: AutocompleteSuggestion,
    currentInput: string,
  ): boolean {
    const start = Math.max(0, Math.min(suggestion.replaceStart, currentInput.length));
    const end = Math.max(start, Math.min(suggestion.replaceEnd, currentInput.length));
    const next = currentInput.slice(0, start) + suggestion.insertText + currentInput.slice(end);
    return next === currentInput;
  }

  private shouldSuppressRefreshAfterSelection(suggestion: AutocompleteSuggestion): boolean {
    return suggestion.completionBehavior !== "continue";
  }

  hide(): void {
    this.dropdownCoordinator.release(this);
    this._latestSuggestions = [];
    this._latestContext = null;
    this._viewState.next(INITIAL_VIEW_STATE);
  }

  private cycleFilterMode(): void {
    const nextMode = this.nextFilterMode(this._filterMode.value);
    this._filterMode.next(nextMode);
    this.saveFilterMode(nextMode);

    const view = this._viewState.value;
    if (!view.visible) return;

    const context = this._latestContext;
    if (!context) {
      this.hide();
      return;
    }

    const filtered = this.suggestionHighlighter.apply(
      this.applyFilterMode(this._latestSuggestions, nextMode),
      context,
    );
    if (filtered.length === 0) {
      this._viewState.next({
        ...view,
        selectedIndex: null,
        suggestions: [],
      });
      return;
    }

    this._viewState.next({
      ...view,
      selectedIndex: null,
      suggestions: filtered,
    });
  }

  private nextFilterMode(mode: SuggestionFilterMode): SuggestionFilterMode {
    if (mode === "all") return "context-only";
    if (mode === "context-only") return "history-only";
    return "all";
  }

  private loadFilterMode(): SuggestionFilterMode {
    try {
      const raw = window.localStorage.getItem(FILTER_MODE_STORAGE_KEY);
      if (raw === "all" || raw === "history-only" || raw === "context-only") {
        return raw;
      }
    } catch {
      // ignore storage access errors
    }
    return "all";
  }

  private saveFilterMode(mode: SuggestionFilterMode): void {
    try {
      window.localStorage.setItem(FILTER_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage access errors
    }
  }

  /** A suggestor's `matches` must not take the panel down; a throw means "no match". */
  private suggestorMatches(
    suggestor: TerminalAutocompleteSuggestorContract,
    context: QueryContext,
  ): boolean {
    try {
      return suggestor.matches(context);
    } catch (reason) {
      this.notifySuggestorIssue(suggestor, reason, context);
      return false;
    }
  }

  private notifySuggestorIssue(
    suggestor: TerminalAutocompleteSuggestorContract,
    reason: unknown,
    context: QueryContext,
  ): void {
    const message = reason instanceof Error ? reason.message : String(reason);
    const key = `${suggestor.id}:${message}`;
    const now = Date.now();
    const lastNotificationAt = this._lastSuggestorIssueNotificationAt.get(key) ?? 0;
    if (now - lastNotificationAt < SUGGESTOR_ISSUE_NOTIFICATION_THROTTLE_MS) {
      return;
    }
    this._lastSuggestorIssueNotificationAt.set(key, now);

    this.sharedSuggestors.reportIssue({
      suggestorId: suggestor.id,
      message,
      input: context.beforeCursor,
      terminalId: this.host.terminalId,
    });
  }

  private hasInputChanged(state: SessionState): boolean {
    return inputSignature(state) !== this._lastInputSignature;
  }

  private isArrowKey(key: string): boolean {
    return key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";
  }

  private isTypingKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key.length === 1) return true;
    return event.key === "Backspace" || event.key === "Delete";
  }
}
