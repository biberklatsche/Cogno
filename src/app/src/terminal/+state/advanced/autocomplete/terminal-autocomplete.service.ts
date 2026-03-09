import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ActionFired, ActionFiredEvent } from "../../../../action/action.models";
import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalAutocompleteSuggestorContract } from "@cogno/core-sdk";
import { TerminalAutocompleteFeatureSuggestorService } from "../../../../app-host/terminal-autocomplete-feature-suggestor.service";
import { TerminalState, TerminalStateManager } from "../../state";
import { TerminalHistoryPersistenceService } from "../history/terminal-history-persistence.service";
import { AutocompleteContextParser } from "./autocomplete-context.parser";
import { AutocompleteSuggestion, AutocompleteViewState, QueryContext } from "./autocomplete.types";
import { HistoryCommandSuggestor } from "./suggestors/history-command.suggestor";
import { HistoryDirectorySuggestor } from "./suggestors/history-directory.suggestor";
import { TerminalAutocompleteSuggestor } from "./suggestors/terminal-autocomplete.suggestor";
import { SuggestionHighlighter } from "./suggestion-highlighter";

const REFRESH_DEBOUNCE_MS = 80;
const SUGGESTOR_TIMEOUT_MS = 180;
const MAX_SUGGESTIONS = 20;
const PANEL_MAX_VISIBLE_ITEMS = 6;

const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 920;
const PANEL_ITEM_HORIZONTAL_PADDING = 16; // 8px left + 8px right
const PANEL_ITEM_GAP = 8;
const PANEL_OUTER_PADDING_AND_BORDER = 10; // panel padding + border budget
const LABEL_MEASURE_MAX_CHARS = 140;
const PANEL_ITEM_HEIGHT_PX = 25;
const PANEL_LIST_EXTRA_PX = 8;
const PANEL_DESCRIPTION_MIN_PX = 30;
export type SuggestionFilterMode = "all" | "history-only" | "context-only";
const FILTER_MODE_STORAGE_KEY = "terminal.autocomplete.filterMode";

const INITIAL_VIEW_STATE: AutocompleteViewState = {
    visible: false,
    x: 0,
    y: 0,
    width: PANEL_MIN_WIDTH,
    placement: "below",
    selectedIndex: null,
    suggestions: [],
};

@Injectable()
export class TerminalAutocompleteService implements OnDestroy {
    private static visibleOwner: TerminalAutocompleteService | null = null;
    private readonly suggestionHighlighter = new SuggestionHighlighter();

    private readonly _viewState = new BehaviorSubject<AutocompleteViewState>(INITIAL_VIEW_STATE);
    private readonly _subscription = new Subscription();
    private readonly _suggestors: TerminalAutocompleteSuggestorContract[] = [];
    private _activeRequestId = 0;
    private _suppressNextRefresh = false;
    private _suppressUntilTyping = false;
    private readonly _keydownHandler: (event: KeyboardEvent) => void;
    private _hostElement?: HTMLElement;
    private _lastInputSignature: string;
    private readonly _filterMode = new BehaviorSubject<SuggestionFilterMode>("all");
    private _latestHighlightedSuggestions: AutocompleteSuggestion[] = [];

    get viewState$() {
        return this._viewState.asObservable();
    }

    get filterMode$() {
        return this._filterMode.asObservable();
    }

    constructor(
        private readonly stateManager: TerminalStateManager,
        private readonly persistence: TerminalHistoryPersistenceService,
        private readonly bus: AppBus,
        private readonly featureSuggestorService: TerminalAutocompleteFeatureSuggestorService,
    ) {
        this._filterMode.next(this.loadFilterMode());
        this._lastInputSignature = this.inputSignature(this.stateManager.state);
        this.registerDefaultSuggestors();
        this.subscribeStateChanges();

        this._keydownHandler = (event: KeyboardEvent) => this.handleKeydown(event);

        window.addEventListener("keydown", this._keydownHandler, { capture: true });
    }

    ngOnDestroy(): void {
        if (TerminalAutocompleteService.visibleOwner === this) {
            TerminalAutocompleteService.visibleOwner = null;
        }
        this._subscription.unsubscribe();
        window.removeEventListener("keydown", this._keydownHandler, { capture: true });
    }

    setHostElement(element: HTMLElement): void {
        this._hostElement = element;
    }

    registerSuggestor(suggestor: TerminalAutocompleteSuggestor): void {
        if (this._suggestors.find(s => s.id === suggestor.id)) return;
        this._suggestors.push(suggestor);
    }

    selectSuggestion(index: number): void {
        this.applySelectedSuggestion(index);
    }

    setSelectedIndex(index: number): void {
        const view = this._viewState.value;
        if (index < 0 || index >= view.suggestions.length) return;
        this._viewState.next({ ...view, selectedIndex: index });
    }

    private registerDefaultSuggestors(): void {
        this.registerSuggestor(new HistoryDirectorySuggestor(this.persistence));
        this.registerSuggestor(new HistoryCommandSuggestor(this.persistence));
        for (const suggestor of this.featureSuggestorService.getSharedSuggestors()) {
            this.registerSuggestor(suggestor);
        }
    }

    private subscribeStateChanges(): void {
        this._subscription.add(
            this.stateManager.state$
                .pipe(debounceTime(REFRESH_DEBOUNCE_MS))
                .subscribe(terminalState => {
                    const viewState = this._viewState.value;
                    if (!this.hasInputChanged(terminalState)) {
                        if (viewState.visible && (!terminalState.isFocused || terminalState.isCommandRunning)) {
                            this.hide();
                        }
                        return;
                    }
                    this._viewState.next({ ...viewState, selectedIndex: null });
                    this._lastInputSignature = this.inputSignature(terminalState);
                    void this.refreshSuggestions(terminalState);
                })
        );

        this._subscription.add(
            this.bus.on$(ActionFired.listener())
                .subscribe((event: ActionFiredEvent) => {
                    if (event.payload !== "cycle_completion_mode") return;

                    const view = this._viewState.value;
                    if (!view.visible) return;

                    this.cycleFilterMode();
                    event.performed = true;
                    event.defaultPrevented = true;
                    event.propagationStopped = true;
                })
        );
    }

    private handleKeydown(event: KeyboardEvent): void {
        if (!this.stateManager.isFocused) return;

        const view = this._viewState.value;
        if (!view.visible) {
            if (this.isArrowKey(event.key)) {
                this._suppressUntilTyping = true;
                return;
            }
            if (this.isTypingKey(event)) {
                this._suppressUntilTyping = false;
            }
            return;
        }

        switch (event.key) {
            case "ArrowDown": {
                event.preventDefault();
                event.stopPropagation();
                const next = view.selectedIndex === null ? 0 : (view.selectedIndex + 1) % view.suggestions.length;
                this.setSelectedIndex(next);
                return;
            }
            case "ArrowUp": {
                event.preventDefault();
                event.stopPropagation();
                const next = view.selectedIndex === null
                    ? view.suggestions.length - 1
                    : (view.selectedIndex <= 0 ? view.suggestions.length - 1 : view.selectedIndex - 1);
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

    private async refreshSuggestions(state: TerminalState): Promise<void> {
        if (this._suppressUntilTyping) {
            this.hide();
            return;
        }
        if (this.shouldHideForState(state)) return;

        const context = AutocompleteContextParser.parse(state);
        if (!context) {
            this.hide();
            return;
        }

        const suggestors = this._suggestors.filter(s => s.matches(context));
        if (suggestors.length === 0) {
            this.hide();
            return;
        }

        const requestId = ++this._activeRequestId;
        const settled = await this.runSuggestors(suggestors, context);
        if (requestId !== this._activeRequestId) {
            return;
        }

        const suggestions = this.rankAndTrimSuggestions(settled, state);
        const highlightedSuggestions = this.suggestionHighlighter.apply(suggestions, context);
        this._latestHighlightedSuggestions = highlightedSuggestions;

        const visibleSuggestions = this.applyFilterMode(highlightedSuggestions, this._filterMode.value);
        if (visibleSuggestions.length === 0) {
            this.hide();
            return;
        }

        const position = this.computePanelPosition(state, visibleSuggestions, this.readRenderedPanelHeight());
        this.takeVisibleOwnership();

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

    private shouldHideForState(state: TerminalState): boolean {
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
        context: QueryContext
    ): Promise<PromiseSettledResult<AutocompleteSuggestion[]>[]> {
        return Promise.allSettled(
            suggestors.map(s => this.withTimeout(s.suggest(context), SUGGESTOR_TIMEOUT_MS))
        );
    }

    private rankAndTrimSuggestions(
        settled: PromiseSettledResult<AutocompleteSuggestion[]>[],
        state: TerminalState
    ): AutocompleteSuggestion[] {
        const merged = settled
            .filter((r): r is PromiseFulfilledResult<AutocompleteSuggestion[]> => r.status === "fulfilled")
            .flatMap(r => r.value);

        const deduped = this.dedupeSuggestions(merged)
            .filter(s => !this.suggestionEqualsCurrentInput(s, state.input.text))
            .sort((a, b) => b.score - a.score);

        if (this._filterMode.value !== "all") {
            return deduped.slice(0, MAX_SUGGESTIONS);
        }

        return this.trimWithSourceBalance(deduped);
    }

    private trimWithSourceBalance(items: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
        if (items.length <= MAX_SUGGESTIONS) return items;

        const history = items.filter(item => this.isHistorySuggestion(item));
        const reservedHistory = history.slice(0, Math.min(3, history.length));
        const used = new Set(reservedHistory);
        const rest = items.filter(item => !used.has(item));

        return [...reservedHistory, ...rest].slice(0, MAX_SUGGESTIONS);
    }

    private applyFilterMode(items: AutocompleteSuggestion[], mode: SuggestionFilterMode): AutocompleteSuggestion[] {
        if (mode === "history-only") {
            return items.filter(item => this.isHistorySuggestion(item));
        }
        if (mode === "context-only") {
            return items.filter(item => !this.isHistorySuggestion(item));
        }
        return this.balanceVisibleTopInAllMode(items);
    }

    private balanceVisibleTopInAllMode(items: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
        if (items.length <= 1) return items;

        const visibleCap = Math.min(PANEL_MAX_VISIBLE_ITEMS, items.length);
        const history = items.filter(item => this.isHistorySuggestion(item));
        const nonHistory = items.filter(item => !this.isHistorySuggestion(item));

        const targetHistory = Math.min(Math.floor(visibleCap / 2), history.length);
        const targetNonHistory = Math.min(visibleCap - targetHistory, nonHistory.length);

        const topHistory = history.slice(0, targetHistory);
        const topNonHistory = nonHistory.slice(0, targetNonHistory);
        const top = [...topHistory, ...topNonHistory];

        const used = new Set(top);
        const rest = items
            .filter(item => !used.has(item))
            .sort((a, b) => b.score - a.score);

        return [...top, ...rest];
    }

    private applySelectedSuggestion(index: number): void {
        const view = this._viewState.value;
        const suggestion = view.suggestions[index];
        if (!suggestion) return;

        const input = this.stateManager.input;
        const paddedInputText = input.text.padEnd(Math.max(input.text.length, suggestion.replaceEnd), " ");
        const start = Math.max(0, Math.min(suggestion.replaceStart, paddedInputText.length));
        const end = Math.max(start, Math.min(suggestion.replaceEnd, paddedInputText.length));
        const inputText = paddedInputText.slice(0, start) + suggestion.insertText + paddedInputText.slice(end);
        const cursorIndex = start + suggestion.insertText.length;

        if (suggestion.selectedPath) {
            this.persistence.markDirectorySelected(suggestion.selectedPath);
        }
        if (suggestion.selectedCommand && this.stateManager.state.cwd) {
            this.persistence.markCommandSelected(suggestion.selectedCommand, this.stateManager.state.cwd);
        }

        this.bus.publish({
            path: ["app", "terminal"],
            type: "ApplyAutocompleteSuggestion",
            payload: {
                terminalId: this.stateManager.terminalId,
                inputText,
                cursorIndex,
            },
        });

        this._suppressNextRefresh = this.shouldSuppressRefreshAfterSelection(suggestion);
        this.hide();
    }

    private computePanelPosition(
        state: TerminalState,
        suggestions: AutocompleteSuggestion[],
        measuredPanelHeight: number | null
    ): { x: number; y: number; width: number; placement: "below" | "above" } {
        const col = Math.max(1, state.cursorPosition.viewport.col);
        const row = Math.max(1, state.cursorPosition.viewport.row);
        const cellWidth = Math.max(1, state.dimensions.cellWidth || 9);
        const cellHeight = Math.max(1, state.dimensions.cellHeight || 18);
        const hostRect = this._hostElement?.getBoundingClientRect();
        const fallbackViewportWidth = Math.max(cellWidth, state.dimensions.cols * cellWidth);
        const viewportWidth = Math.max(cellWidth, state.dimensions.viewportWidth || fallbackViewportWidth);
        const windowWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || viewportWidth);
        const windowHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || cellHeight);
        const bounds = this.resolveBoundsRect(windowWidth, windowHeight);
        const rightUiInset = this.resolveRightUiInset(windowWidth);
        const effectiveRight = Math.max(bounds.left + 16, bounds.right - rightUiInset);
        // Width is derived from the full window bounds (minus right-side overlays), not pane width.
        const availableWidth = Math.max(240, effectiveRight - bounds.left);

        const labelCharPx = Math.max(6, Math.floor(cellWidth * 0.95));
        const metaCharPx = Math.max(6, Math.floor(labelCharPx * 0.9));
        const widestLinePx = suggestions.reduce((max, item) => {
            const labelChars = Math.min(item.label.length, LABEL_MEASURE_MAX_CHARS);
            const metaText = `${item.source} · ${item.score}`;
            const linePx =
                (labelChars * labelCharPx) +
                PANEL_ITEM_GAP +
                (metaText.length * metaCharPx) +
                PANEL_ITEM_HORIZONTAL_PADDING;
            return Math.max(max, linePx);
        }, 0);
        const desiredWidth = widestLinePx + PANEL_OUTER_PADDING_AND_BORDER;
        const estimatedPanelWidth = Math.max(
            PANEL_MIN_WIDTH,
            Math.min(availableWidth - 8, Math.min(PANEL_MAX_WIDTH, desiredWidth))
        );

        const cursorX = (hostRect?.left ?? 0) + (col - 1) * cellWidth;
        const minX = Math.max(4, bounds.left + 4);
        const maxX = Math.max(minX, effectiveRight - estimatedPanelWidth - 4);
        const x = Math.max(minX, Math.min(cursorX, maxX));

        const cursorLineTop = (hostRect?.top ?? 0) + (row - 1) * cellHeight;
        const belowY = cursorLineTop + cellHeight + 4;
        const aboveAnchorY = cursorLineTop - cellHeight;
        const minimumTopY = Math.max(4, bounds.top + 4);
        const estimatedPanelHeight = this.estimatePanelHeight(suggestions.length, cellHeight);
        const panelHeight = measuredPanelHeight ?? estimatedPanelHeight;
        const hasRoomForBelowAnchor = belowY <= bounds.bottom - 4;
        const hasRoomBelow = hasRoomForBelowAnchor && (belowY + panelHeight <= bounds.bottom - 4);
        const placement: "below" | "above" = hasRoomBelow ? "below" : "above";

        let y = placement === "below" ? Math.max(minimumTopY, belowY) : Math.max(minimumTopY, aboveAnchorY);

        if (panelHeight > 0) {
            if (placement === "below") {
                const maximumBelowY = Math.max(minimumTopY, bounds.bottom - panelHeight - 4);
                y = Math.min(y, maximumBelowY);
            } else {
                // Above placement uses translateY(-100%), so this anchor must keep panel top within viewport.
                const minimumAboveAnchorY = minimumTopY + panelHeight;
                y = Math.max(y, minimumAboveAnchorY);
            }
        }

        return {
            x,
            y,
            width: estimatedPanelWidth,
            placement,
        };
    }

    private estimatePanelHeight(suggestionCount: number, cellHeight: number): number {
        const rowHeight = Math.max(PANEL_ITEM_HEIGHT_PX, Math.round(cellHeight * 1.7));
        const visibleRows = Math.max(1, Math.min(PANEL_MAX_VISIBLE_ITEMS, suggestionCount));
        return (
            PANEL_OUTER_PADDING_AND_BORDER +
            PANEL_LIST_EXTRA_PX +
            (visibleRows * rowHeight) +
            PANEL_DESCRIPTION_MIN_PX
        );
    }

    private repositionUsingRenderedPanelHeight(): void {
        const view = this._viewState.value;
        if (!view.visible) return;

        const measuredPanelHeight = this.readRenderedPanelHeight();
        if (measuredPanelHeight === null) return;

        const position = this.computePanelPosition(this.stateManager.state, view.suggestions, measuredPanelHeight);
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
                };
            } else {
                if (!existing.suggestion.detail && item.detail) {
                    existing.suggestion.detail = item.detail;
                }
                if (!existing.suggestion.description && item.description) {
                    existing.suggestion.description = item.description;
                }
                if (!existing.suggestion.selectedPath && item.selectedPath) {
                    existing.suggestion.selectedPath = item.selectedPath;
                }
                if (!existing.suggestion.selectedCommand && item.selectedCommand) {
                    existing.suggestion.selectedCommand = item.selectedCommand;
                }
            }
        }

        return [...map.values()].map(entry => {
            const sources = [...entry.sources].sort();
            const sourceBonus = Math.max(0, sources.length - 1) * 8;
            return {
                ...entry.suggestion,
                source: sources.join(" + "),
                score: entry.suggestion.score + sourceBonus,
            };
        });
    }

    private suggestionEqualsCurrentInput(suggestion: AutocompleteSuggestion, currentInput: string): boolean {
        const start = Math.max(0, Math.min(suggestion.replaceStart, currentInput.length));
        const end = Math.max(start, Math.min(suggestion.replaceEnd, currentInput.length));
        const next = currentInput.slice(0, start) + suggestion.insertText + currentInput.slice(end);
        return next === currentInput;
    }

    private shouldSuppressRefreshAfterSelection(suggestion: AutocompleteSuggestion): boolean {
        return suggestion.completionBehavior !== "continue";
    }

    private hide(): void {
        if (TerminalAutocompleteService.visibleOwner === this) {
            TerminalAutocompleteService.visibleOwner = null;
        }
        this._latestHighlightedSuggestions = [];
        this._viewState.next(INITIAL_VIEW_STATE);
    }

    private cycleFilterMode(): void {
        const nextMode = this.nextFilterMode(this._filterMode.value);
        this._filterMode.next(nextMode);
        this.saveFilterMode(nextMode);

        const view = this._viewState.value;
        if (!view.visible) return;

        const filtered = this.applyFilterMode(this._latestHighlightedSuggestions, nextMode);
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

    private isHistorySuggestion(item: AutocompleteSuggestion): boolean {
        const parts = item.source
            .split("+")
            .map(v => v.trim().toLowerCase())
            .filter(Boolean);
        return parts.some(part => part.includes("history"));
    }

    private takeVisibleOwnership(): void {
        const previous = TerminalAutocompleteService.visibleOwner;
        if (previous && previous !== this) {
            previous.hide();
        }
        TerminalAutocompleteService.visibleOwner = this;
    }

    private resolveBoundsRect(windowWidth: number, windowHeight: number): DOMRect {
        return new DOMRect(0, 0, windowWidth, windowHeight);
    }

    private resolveRightUiInset(windowWidth: number): number {
        // Reserve space for visible right side menu UI so autocomplete never renders under it.
        const host = document.querySelector("app-side-menu");
        if (!host) return 0;

        const candidates = [
            ...host.querySelectorAll<HTMLElement>("aside:not(.hidden)"),
            ...host.querySelectorAll<HTMLElement>("menu:not(.hidden)"),
        ];

        let maxInset = 0;
        for (const el of candidates) {
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") continue;

            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;

            const inset = Math.max(0, windowWidth - rect.left);
            if (inset > maxInset) maxInset = inset;
        }
        return maxInset;
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    private hasInputChanged(state: TerminalState): boolean {
        return this.inputSignature(state) !== this._lastInputSignature;
    }

    private inputSignature(state: TerminalState): string {
        const input = state.input;
        return `${input.text}\u0000${input.cursorIndex}\u0000${input.maxCursorIndex}`;
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
