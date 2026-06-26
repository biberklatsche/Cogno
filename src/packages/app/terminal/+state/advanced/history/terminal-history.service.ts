import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { ActionFired, ActionFiredEvent } from "../../../../action/action.models";
import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalState, TerminalStateManager } from "../../state";
import {
  computeDropdownPanelPosition,
  estimateDropdownPanelHeight,
  resolveBoundsRect,
  resolveRightUiInset,
} from "../ui/dropdown-panel-positioning";
import { TerminalDropdownCoordinatorService } from "../ui/terminal-dropdown-coordinator.service";
import { RecentCommandRow } from "./history.repository";
import { HistoryEntry, HistoryScope, TerminalHistoryViewState } from "./recent-history.types";
import { TerminalHistoryPersistenceService } from "./terminal-history-persistence.service";

const REFRESH_DEBOUNCE_MS = 80;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 920;
const PANEL_OUTER_PADDING_AND_BORDER = 10;
const PANEL_FOOTER_PX = 38;
const LABEL_MEASURE_MAX_CHARS = 140;
const SCOPE_STORAGE_KEY = "terminal.history.scope";

const INITIAL_VIEW_STATE: TerminalHistoryViewState = {
  visible: false,
  x: 0,
  y: 0,
  width: PANEL_MIN_WIDTH,
  placement: "below",
  selectedIndex: null,
  entries: [],
  scope: "global",
};

@Injectable()
export class TerminalHistoryService implements OnDestroy {
  private readonly _viewState = new BehaviorSubject<TerminalHistoryViewState>({
    ...INITIAL_VIEW_STATE,
    scope: this.loadScope(),
  });
  private readonly _subscription = new Subscription();
  private _hostElement?: HTMLElement;
  private _allEntries: HistoryEntry[] = [];
  private _lastInputSignature = "";
  private _activeRequestId = 0;

  get viewState$() {
    return this._viewState.asObservable();
  }

  constructor(
    private readonly stateManager: TerminalStateManager,
    private readonly persistence: TerminalHistoryPersistenceService,
    private readonly bus: AppBus,
    private readonly dropdownCoordinator: TerminalDropdownCoordinatorService,
  ) {
    this.subscribeStateChanges();
  }

  ngOnDestroy(): void {
    this.dropdownCoordinator.release(this);
    this._subscription.unsubscribe();
  }

  setHostElement(element: HTMLElement): void {
    this._hostElement = element;
  }

  setSelectedIndex(index: number): void {
    const view = this._viewState.value;
    if (index < 0 || index >= view.entries.length) return;
    this._viewState.next({ ...view, selectedIndex: index });
  }

  selectEntry(index: number): void {
    this.applySelectedEntry(index);
  }

  hide(): void {
    this.dropdownCoordinator.release(this);
    this._allEntries = [];
    this._viewState.next({ ...INITIAL_VIEW_STATE, scope: this._viewState.value.scope });
  }

  private subscribeStateChanges(): void {
    this._subscription.add(
      this.stateManager.state$.pipe(debounceTime(REFRESH_DEBOUNCE_MS)).subscribe((state) => {
        const view = this._viewState.value;
        if (!view.visible) return;

        if (!state.isFocused || state.isCommandRunning) {
          this.hide();
          return;
        }

        const signature = this.inputSignature(state);
        if (signature === this._lastInputSignature) return;
        this._lastInputSignature = signature;
        this.applyTextFilter(state.input.text);
      }),
    );

    this._subscription.add(
      this.bus.on$(ActionFired.listener()).subscribe((event: ActionFiredEvent) => {
        if (event.payload === "trigger_command_history") {
          void this.handleTriggerCommandHistory(event);
          return;
        }

        if (event.payload !== "cycle_tab") return;
        if (!this._viewState.value.visible) return;

        void this.cycleScope();
        event.performed = true;
        event.defaultPrevented = true;
        event.propagationStopped = true;
      }),
    );
  }

  dispatchKeydown(event: KeyboardEvent): void {
    if (!this.stateManager.isFocused) return;

    const view = this._viewState.value;
    if (!view.visible) return;

    switch (event.key) {
      case "ArrowUp": {
        // Newest entry is rendered at the bottom, so "up" steps toward older entries.
        event.preventDefault();
        event.stopPropagation();
        const next =
          view.selectedIndex === null ? 0 : (view.selectedIndex + 1) % view.entries.length;
        this.setSelectedIndex(next);
        return;
      }
      case "ArrowDown": {
        event.preventDefault();
        event.stopPropagation();
        const next =
          view.selectedIndex === null
            ? view.entries.length - 1
            : view.selectedIndex <= 0
              ? view.entries.length - 1
              : view.selectedIndex - 1;
        this.setSelectedIndex(next);
        return;
      }
      case "Enter": {
        if (view.selectedIndex === null) return;
        event.preventDefault();
        event.stopPropagation();
        this.applySelectedEntry(view.selectedIndex);
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

  private async handleTriggerCommandHistory(event: ActionFiredEvent): Promise<void> {
    if (!this.stateManager.isFocused) return;

    await this.showHistory();

    if (this._viewState.value.visible) {
      event.performed = true;
      event.defaultPrevented = true;
      event.propagationStopped = true;
    }
  }

  private async showHistory(): Promise<void> {
    const requestId = ++this._activeRequestId;
    const state = this.stateManager.state;
    const preferredScope = this._viewState.value.scope;
    const { scope, rows } = await this.fetchEntries(preferredScope, state.cwd);
    if (requestId !== this._activeRequestId) return;
    this._allEntries = this.toEntries(rows);
    this._lastInputSignature = this.inputSignature(state);

    const entries = this.filterEntries(this._allEntries, state.input.text);
    if (entries.length === 0) {
      this.hide();
      return;
    }

    const position = this.computePanelPosition(state, entries);
    this.dropdownCoordinator.claim(this);

    this._viewState.next({
      visible: true,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
      selectedIndex: 0,
      entries,
      scope,
    });
  }

  private async cycleScope(): Promise<void> {
    const requestId = ++this._activeRequestId;
    const preferredScope = this.nextScope(this._viewState.value.scope);
    this.saveScope(preferredScope);

    const state = this.stateManager.state;
    const { scope, rows } = await this.fetchEntries(preferredScope, state.cwd);
    if (requestId !== this._activeRequestId) return;

    // Re-read view after the async gap — hide() may have fired during fetchEntries.
    const view = this._viewState.value;
    if (!view.visible) return;

    this._allEntries = this.toEntries(rows);
    const entries = this.filterEntries(this._allEntries, state.input.text);

    if (entries.length === 0) {
      this.hide();
      return;
    }

    const position = this.computePanelPosition(state, entries);
    this._viewState.next({
      ...view,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
      scope,
      selectedIndex: 0,
      entries,
    });
  }

  /**
   * A narrow scope (session/cwd) is often empty for a brand-new terminal or directory.
   * Fall back to the broader "global" scope for display only — the user's chosen
   * scope preference (persisted via saveScope) is left untouched.
   */
  private async fetchEntries(
    preferredScope: HistoryScope,
    cwdRaw?: string,
  ): Promise<{ scope: HistoryScope; rows: RecentCommandRow[] }> {
    const rows = await this.persistence.getRecentCommands({ scope: preferredScope, cwdRaw });
    if (rows.length > 0 || preferredScope === "global") {
      return { scope: preferredScope, rows };
    }

    const globalRows = await this.persistence.getRecentCommands({ scope: "global", cwdRaw });
    return { scope: "global", rows: globalRows };
  }

  private toEntries(rows: RecentCommandRow[]): HistoryEntry[] {
    return rows.map((row) => ({
      command: row.command,
      executedAt: row.executedAt,
      origin: row.isCurrentSession ? "session" : row.isCurrentCwd ? "cwd" : undefined,
    }));
  }

  private applyTextFilter(inputText: string): void {
    const view = this._viewState.value;
    const entries = this.filterEntries(this._allEntries, inputText);
    if (entries.length === 0) {
      this._viewState.next({ ...view, selectedIndex: null, entries: [] });
      return;
    }
    this._viewState.next({ ...view, selectedIndex: 0, entries });
  }

  private filterEntries(entries: HistoryEntry[], inputText: string): HistoryEntry[] {
    const query = inputText.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.command.toLowerCase().includes(query));
  }

  private applySelectedEntry(index: number): void {
    const view = this._viewState.value;
    const entry = view.entries[index];
    if (!entry) return;

    if (this.stateManager.state.cwd) {
      this.persistence.markCommandSelected(entry.command, this.stateManager.state.cwd);
    }

    this.bus.publish({
      path: ["app", "terminal"],
      type: "ApplyAutocompleteSuggestion",
      payload: {
        terminalId: this.stateManager.terminalId,
        inputText: entry.command,
        cursorIndex: entry.command.length,
      },
    });

    this.hide();
  }

  private computePanelPosition(
    state: TerminalState,
    entries: HistoryEntry[],
  ): { x: number; y: number; width: number; placement: "below" | "above" } {
    const cellWidth = Math.max(1, state.dimensions.cellWidth || 9);
    const cellHeight = Math.max(1, state.dimensions.cellHeight || 18);
    const windowWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const windowHeight = Math.max(
      1,
      window.innerHeight || document.documentElement.clientHeight || cellHeight,
    );
    const bounds = resolveBoundsRect(windowWidth, windowHeight);
    const rightUiInset = resolveRightUiInset(windowWidth);
    const effectiveRight = Math.max(bounds.left + 16, bounds.right - rightUiInset);
    const availableWidth = Math.max(240, effectiveRight - bounds.left);

    const labelCharPx = Math.max(6, Math.floor(cellWidth * 0.95));
    const widestLinePx = entries.reduce((max, entry) => {
      const labelChars = Math.min(entry.command.length, LABEL_MEASURE_MAX_CHARS);
      return Math.max(max, labelChars * labelCharPx + PANEL_OUTER_PADDING_AND_BORDER);
    }, 0);
    const estimatedPanelWidth = Math.max(
      PANEL_MIN_WIDTH,
      Math.min(availableWidth - 8, Math.min(PANEL_MAX_WIDTH, widestLinePx)),
    );

    return computeDropdownPanelPosition({
      col: state.cursorPosition.viewport.col,
      row: state.cursorPosition.viewport.row,
      cellWidth,
      cellHeight,
      hostRect: this._hostElement?.getBoundingClientRect(),
      windowWidth,
      windowHeight,
      estimatedPanelWidth,
      estimatedPanelHeight: estimateDropdownPanelHeight(
        entries.length,
        cellHeight,
        PANEL_FOOTER_PX,
      ),
    });
  }

  private nextScope(scope: HistoryScope): HistoryScope {
    if (scope === "global") return "cwd";
    if (scope === "cwd") return "session";
    return "global";
  }

  private loadScope(): HistoryScope {
    try {
      const raw = window.localStorage.getItem(SCOPE_STORAGE_KEY);
      if (raw === "global" || raw === "cwd" || raw === "session") {
        return raw;
      }
    } catch {
      // ignore storage access errors
    }
    return "global";
  }

  private saveScope(scope: HistoryScope): void {
    try {
      window.localStorage.setItem(SCOPE_STORAGE_KEY, scope);
    } catch {
      // ignore storage access errors
    }
  }

  private inputSignature(state: TerminalState): string {
    const input = state.input;
    return `${input.text} ${input.cursorIndex} ${input.maxCursorIndex}`;
  }
}
