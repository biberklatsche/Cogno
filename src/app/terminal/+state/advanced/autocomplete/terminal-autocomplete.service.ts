import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalState, TerminalStateManager } from "../../state";
import { TerminalHistoryPersistenceService } from "../history/terminal-history-persistence.service";
import { AutocompleteContextParser } from "./autocomplete-context.parser";
import { AutocompleteSuggestion, AutocompleteViewState, QueryContext } from "./autocomplete.types";
import { FilesystemDirectorySuggestor } from "./suggestors/filesystem-directory.suggestor";
import { HistoryCommandSuggestor } from "./suggestors/history-command.suggestor";
import { HistoryDirectorySuggestor } from "./suggestors/history-directory.suggestor";
import { NpmScriptsSuggestor } from "./suggestors/npm-scripts.suggestor";
import { TerminalAutocompleteSuggestor } from "./suggestors/terminal-autocomplete.suggestor";

const REFRESH_DEBOUNCE_MS = 80;
const SUGGESTOR_TIMEOUT_MS = 180;
const MAX_SUGGESTIONS = 20;
const MAX_VISIBLE_SUGGESTIONS = 5;

const PANEL_MIN_WIDTH = 260;
const PANEL_MAX_WIDTH = 760;
const PANEL_ITEM_HEIGHT = 32;
const PANEL_VERTICAL_PADDING = 8;

const INITIAL_VIEW_STATE: AutocompleteViewState = {
    visible: false,
    x: 0,
    y: 0,
    selectedIndex: null,
    suggestions: [],
};

@Injectable()
export class TerminalAutocompleteService implements OnDestroy {
    private static visibleOwner: TerminalAutocompleteService | null = null;

    private readonly _viewState = new BehaviorSubject<AutocompleteViewState>(INITIAL_VIEW_STATE);
    private readonly _subscription = new Subscription();
    private readonly _suggestors: TerminalAutocompleteSuggestor[] = [];
    private _activeRequestId = 0;
    private _suppressNextRefresh = false;
    private _suppressUntilTyping = false;
    private readonly _keydownHandler: (event: KeyboardEvent) => void;
    private _hostElement?: HTMLElement;
    private _lastInputSignature: string;

    get viewState$() {
        return this._viewState.asObservable();
    }

    constructor(
        private readonly stateManager: TerminalStateManager,
        private readonly persistence: TerminalHistoryPersistenceService,
        private readonly bus: AppBus,
    ) {
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
        this.registerSuggestor(new FilesystemDirectorySuggestor());
        this.registerSuggestor(new HistoryCommandSuggestor(this.persistence));
        this.registerSuggestor(new NpmScriptsSuggestor());
    }

    private subscribeStateChanges(): void {
        this._subscription.add(
            this.stateManager.state$
                .pipe(debounceTime(REFRESH_DEBOUNCE_MS))
                .subscribe(terminalState => {
                    if (!this.hasInputChanged(terminalState)) {
                        if (this._viewState.value.visible && (!terminalState.isFocused || terminalState.isCommandRunning)) {
                            this.hide();
                        }
                        return;
                    }
                    this._lastInputSignature = this.inputSignature(terminalState);
                    void this.refreshSuggestions(terminalState);
                })
        );
    }

    private handleKeydown(event: KeyboardEvent): void {
        if (!this.stateManager.isFocused) return;

        const view = this._viewState.value;
        if (!view.visible || view.suggestions.length === 0) {
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
            case "Enter":
            case "Tab": {
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
        if (suggestions.length === 0) {
            this.hide();
            return;
        }
        const highlightedSuggestions = this.applyHighlights(suggestions, context);

        const position = this.computePanelPosition(state, highlightedSuggestions.length);
        this.takeVisibleOwnership();

        this._viewState.next({
            visible: true,
            x: position.x,
            y: position.y,
            selectedIndex: null,
            suggestions: highlightedSuggestions,
        });
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

        return this.dedupeSuggestions(merged)
            .filter(s => !this.suggestionEqualsCurrentInput(s, state.input.text))
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_SUGGESTIONS);
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

        if (suggestion.kind === "directory" && suggestion.selectedPath) {
            this.persistence.markDirectorySelected(suggestion.selectedPath);
        }
        if (suggestion.kind === "command" && suggestion.selectedCommand && this.stateManager.state.cwd) {
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

        this._suppressNextRefresh = true;
        this.hide();
    }

    private computePanelPosition(state: TerminalState, suggestionCount: number): { x: number; y: number } {
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
        const availableWidth = Math.max(120, Math.min(bounds.width, viewportWidth));

        const estimatedPanelWidth = Math.min(
            Math.max(120, availableWidth - 8),
            Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.floor(availableWidth * 0.45)))
        );
        const visibleSuggestions = Math.min(suggestionCount, MAX_VISIBLE_SUGGESTIONS);
        const estimatedPanelHeight = PANEL_VERTICAL_PADDING + visibleSuggestions * PANEL_ITEM_HEIGHT;

        const cursorX = (hostRect?.left ?? 0) + (col - 1) * cellWidth;
        const minX = Math.max(4, bounds.left + 4);
        const maxX = Math.max(minX, bounds.right - estimatedPanelWidth - 4);
        const x = Math.max(minX, Math.min(cursorX, maxX));

        const topOfCursorLine = (hostRect?.top ?? 0) + (row - 1) * cellHeight;
        const belowY = topOfCursorLine + cellHeight + 4;
        // If we cannot render below, render above so panel bottom is exactly one row-height above cursor line.
        const aboveY = topOfCursorLine - estimatedPanelHeight - cellHeight;
        const minY = Math.max(4, bounds.top + 4);
        const maxY = Math.max(minY, bounds.bottom - estimatedPanelHeight - 4);
        const hasRoomBelow = belowY + estimatedPanelHeight <= bounds.bottom - 4;
        const y = hasRoomBelow
            ? Math.max(minY, Math.min(belowY, maxY))
            : Math.max(minY, Math.min(aboveY, maxY));

        return {
            x,
            y,
        };
    }

    private dedupeSuggestions(items: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
        const map = new Map<string, AutocompleteSuggestion>();
        for (const item of items) {
            const key = `${item.kind}:${item.insertText}:${item.replaceStart}:${item.replaceEnd}`;
            const existing = map.get(key);
            if (!existing || item.score > existing.score) {
                map.set(key, item);
            }
        }
        return [...map.values()];
    }

    private suggestionEqualsCurrentInput(suggestion: AutocompleteSuggestion, currentInput: string): boolean {
        const start = Math.max(0, Math.min(suggestion.replaceStart, currentInput.length));
        const end = Math.max(start, Math.min(suggestion.replaceEnd, currentInput.length));
        const next = currentInput.slice(0, start) + suggestion.insertText + currentInput.slice(end);
        return next === currentInput;
    }

    private hide(): void {
        if (TerminalAutocompleteService.visibleOwner === this) {
            TerminalAutocompleteService.visibleOwner = null;
        }
        this._viewState.next(INITIAL_VIEW_STATE);
    }

    private takeVisibleOwnership(): void {
        const previous = TerminalAutocompleteService.visibleOwner;
        if (previous && previous !== this) {
            previous.hide();
        }
        TerminalAutocompleteService.visibleOwner = this;
    }

    private resolveBoundsRect(windowWidth: number, windowHeight: number): DOMRect {
        const fallback = new DOMRect(0, 0, windowWidth, windowHeight);
        const host = this._hostElement;
        if (!host) return fallback;

        const grid = host.closest("app-grid") as HTMLElement | null;
        if (grid) return grid.getBoundingClientRect();

        const gridList = host.closest("app-grid-list") as HTMLElement | null;
        const main = gridList?.querySelector(".main") as HTMLElement | null;
        if (main) return main.getBoundingClientRect();

        return fallback;
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

    private applyHighlights(items: AutocompleteSuggestion[], context: QueryContext): AutocompleteSuggestion[] {
        const needle = this.highlightNeedle(context);
        if (!needle) return items;

        return items.map(item => ({
            ...item,
            matchRanges: this.findMatchRanges(item.label, needle),
        }));
    }

    private highlightNeedle(context: QueryContext): string {
        if (context.mode === "command") {
            return context.query.trim();
        }
        return context.fragment.trim();
    }

    private findMatchRanges(label: string, needle: string): Array<{ start: number; end: number }> {
        if (!label || !needle) return [];
        const ranges: Array<{ start: number; end: number }> = [];
        const haystack = label.toLowerCase();
        const query = needle.toLowerCase();
        let from = 0;
        while (from < haystack.length) {
            const idx = haystack.indexOf(query, from);
            if (idx < 0) break;
            ranges.push({ start: idx, end: idx + query.length });
            from = idx + query.length;
        }
        return ranges;
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
