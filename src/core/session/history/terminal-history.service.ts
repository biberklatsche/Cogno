import { Injectable, OnDestroy } from "@angular/core";
import { RecentCommandRow } from "@cogno/core/command-log/command-log.api";
import {
  HistoryEntry,
  HistoryScope,
  TerminalHistoryViewState,
} from "@cogno/core/command-log/recent-history.types";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
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
import { TerminalHistoryScopeStore } from "./terminal-history-scope.store";

const REFRESH_DEBOUNCE_MS = 80;
const PANEL_ITEM_HORIZONTAL_PADDING = 16; // 8px left + 8px right
const PANEL_ITEM_GAP = 8;
const PANEL_FOOTER_PX = 38;
const LABEL_MEASURE_MAX_CHARS = 140;
const META_COLUMN_PX = 110; // origin dot + time-ago text + gap

export const INITIAL_VIEW_STATE: TerminalHistoryViewState = {
  visible: false,
  x: 0,
  y: 0,
  width: DROPDOWN_PANEL_MIN_WIDTH,
  placement: "below",
  selectedIndex: null,
  entries: [],
  scope: "global",
};

@Injectable()
export class TerminalHistoryService implements OnDestroy {
  private readonly _viewState = new BehaviorSubject<TerminalHistoryViewState>({
    ...INITIAL_VIEW_STATE,
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
    private readonly host: SessionHost,
    private readonly commandLog: SessionCommandLog,
    private readonly dropdownCoordinator: TerminalDropdownCoordinatorService,
    private readonly configService: ConfigService,
    private readonly scopeStore: TerminalHistoryScopeStore,
  ) {
    this._viewState.next({ ...this._viewState.value, scope: this.scopeStore.scope });
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

  hide(): void {
    this.dropdownCoordinator.release(this);
    this._allEntries = [];
    this._viewState.next({ ...INITIAL_VIEW_STATE, scope: this._viewState.value.scope });
  }

  private subscribeStateChanges(): void {
    this._subscription.add(
      this.host.state$.pipe(debounceTime(REFRESH_DEBOUNCE_MS)).subscribe((state) => {
        const view = this._viewState.value;
        if (!view.visible) return;

        if (!state.isFocused || state.isCommandRunning) {
          this.hide();
          return;
        }

        const signature = inputSignature(state);
        if (signature === this._lastInputSignature) return;
        this._lastInputSignature = signature;
        this.applyTextFilter(state.input.text);
      }),
    );

    this._subscription.add(
      this.scopeStore.scope$.subscribe((scope) => void this.applyScopeChange(scope)),
    );
  }

  dispatchKeydown(event: KeyboardEvent): void {
    if (!this.host.isFocused) return;

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
        this.selectEntry(view.selectedIndex);
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

  /** Shows the history on request; true when it is showing afterwards. */
  async triggerCommandHistory(): Promise<boolean> {
    if (!this.host.isFocused) return false;

    await this.showHistory();
    return this._viewState.value.visible;
  }

  /** Advances the shared scope while the history is showing; true when it did. */
  cycleTab(): boolean {
    if (!this._viewState.value.visible) return false;
    // Only advance the shared scope; every tab (this one included) reacts uniformly through
    // the scope$ subscription, so there is no separate code path for the originating tab.
    this.scopeStore.cycle();
    return true;
  }

  private async showHistory(): Promise<void> {
    const requestId = ++this._activeRequestId;
    const state = this.host.state;
    const scope = this.scopeStore.scope;
    const rows = await this.commandLog.getRecentCommands({ scope, cwdRaw: state.cwd });
    if (requestId !== this._activeRequestId) return;
    this._allEntries = this.toEntries(rows);
    this._lastInputSignature = inputSignature(state);

    const entries = this.filterEntries(this._allEntries, state.input.text);
    const position = this.computePanelPosition(state, entries);
    this.dropdownCoordinator.claim(this);

    this._viewState.next({
      visible: true,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
      selectedIndex: entries.length > 0 ? 0 : null,
      entries,
      scope,
    });
  }

  /**
   * Reacts to a scope change from the shared store — fired for the tab that cycled it and every
   * other tab. When the panel is closed we only sync the badge so it opens in the current scope;
   * when it is open we re-query using *this* tab's own cwd/session context.
   */
  private async applyScopeChange(scope: HistoryScope): Promise<void> {
    const view = this._viewState.value;
    if (view.scope === scope) return;

    if (!view.visible) {
      this._viewState.next({ ...view, scope });
      return;
    }

    const requestId = ++this._activeRequestId;
    const state = this.host.state;
    const rows = await this.commandLog.getRecentCommands({ scope, cwdRaw: state.cwd });
    if (requestId !== this._activeRequestId) return;

    // Re-read view after the async gap — hide() may have fired during the fetch.
    const current = this._viewState.value;
    if (!current.visible) return;

    this._allEntries = this.toEntries(rows);
    const entries = this.filterEntries(this._allEntries, state.input.text);

    const position = this.computePanelPosition(state, entries);
    this._viewState.next({
      ...current,
      x: position.x,
      y: position.y,
      width: position.width,
      placement: position.placement,
      scope,
      selectedIndex: entries.length > 0 ? 0 : null,
      entries,
    });
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

  selectEntry(index: number): void {
    const view = this._viewState.value;
    const entry = view.entries[index];
    if (!entry) return;

    if (this.host.state.cwd) {
      this.commandLog.markCommandSelected(entry.command, this.host.state.cwd);
    }

    const autoExecute = this.configService.config.terminal?.history?.auto_execute ?? false;
    this.host.replaceInput(entry.command, entry.command.length, autoExecute);

    this.hide();
  }

  private computePanelPosition(state: SessionState, entries: HistoryEntry[]): DropdownPosition {
    return positionDropdownPanel({
      state,
      hostRect: this._hostElement?.getBoundingClientRect(),
      items: entries,
      itemWidthPx: (entry, labelCharPx) =>
        Math.min(entry.command.length, LABEL_MEASURE_MAX_CHARS) * labelCharPx +
        PANEL_ITEM_GAP +
        META_COLUMN_PX +
        PANEL_ITEM_HORIZONTAL_PADDING,
      footerPx: PANEL_FOOTER_PX,
    });
  }
}
