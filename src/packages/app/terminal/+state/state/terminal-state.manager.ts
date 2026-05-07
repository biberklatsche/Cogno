import { DestroyRef, Injectable } from "@angular/core";
import { PathFactory } from "@cogno/app/app-host/path.factory";
import { OS } from "@cogno/app-tauri/os";
import { IPathAdapter } from "@cogno/core-api";
import { BehaviorSubject, map, Observable, Subject, takeUntil } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { ShellType } from "../../../config/+models/config";
import { ShellProfile } from "../../../config/+models/shell-config";
import { ConfigService } from "../../../config/+state/config.service";
import { TerminalId } from "../../../grid-list/+model/model";
import {
  ExecutedCommand,
  TerminalCommandHistoryStore,
} from "../advanced/history/terminal-command-history.store";
import { TerminalHistoryPersistenceService } from "../advanced/history/terminal-history-persistence.service";
import { ShellContext } from "../advanced/model/models";
import { Command } from "./command.model";
import {
  INITIAL_STATE,
  TerminalCursorPosition,
  TerminalDimensions,
  TerminalInput,
  TerminalMousePosition,
  TerminalProgressState,
  TerminalState,
} from "./terminal.state";
import { deriveShellContext } from "./terminal-shell-context.util";

@Injectable()
export class TerminalStateManager {
  private readonly _stateSubject: BehaviorSubject<TerminalState>;
  private readonly disposeSignal: Subject<void> = new Subject<void>();
  private _pathAdapter?: IPathAdapter;
  private isDisposed = false;

  constructor(
    private _bus: AppBus,
    private _historyStore: TerminalCommandHistoryStore = new TerminalCommandHistoryStore(),
    private _historyPersistence: TerminalHistoryPersistenceService = new TerminalHistoryPersistenceService(),
    destroyRef?: DestroyRef,
    private configService?: ConfigService,
  ) {
    destroyRef?.onDestroy(() => this.dispose());
    this._stateSubject = new BehaviorSubject<TerminalState>(INITIAL_STATE);

    this._bus
      .onType$("FocusTerminal", { path: ["app", "terminal"] })
      .pipe(takeUntil(this.disposeSignal))
      .subscribe((event) => {
        const ownTerminalId = this._stateSubject.value.terminalId;
        const focusedTerminalId = event.payload;
        if (!ownTerminalId || !focusedTerminalId) return;
        this.updateState({ isFocused: ownTerminalId === focusedTerminalId });
      });

    this._bus
      .onType$("ConfigLoaded", { path: ["app", "settings"] })
      .pipe(takeUntil(this.disposeSignal))
      .subscribe(() => {
        if (!this.isTerminalNotificationBadgeEnabled()) {
          this.clearUnreadNotification();
        }
      });
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.publishTerminalBusyChanged(false);
    this.disposeSignal.next();
    this.disposeSignal.complete();
  }

  initialize(terminalId: string, shellType: ShellType, shellProfile?: ShellProfile): void {
    const shellContext: ShellContext = deriveShellContext(shellType, shellProfile, OS.platform());
    this._pathAdapter = PathFactory.createAdapter(shellContext);
    this._historyPersistence.initialize(shellContext, this._pathAdapter);
    this.updateState({
      terminalId,
      shellContext,
      isPaneMaximized: false,
      hasSelection: false,
      isFocused: false,
    });
  }

  private updateState(updates: Partial<TerminalState>): void {
    this._stateSubject.next({
      ...this._stateSubject.value,
      ...updates,
    });
  }

  // ---- State getters/streams wie vorher ----

  get state$(): Observable<TerminalState> {
    return this._stateSubject.asObservable();
  }

  get state(): TerminalState {
    return this._stateSubject.value;
  }

  get cursorPosition$(): Observable<TerminalCursorPosition> {
    return this._stateSubject.pipe(map((s) => s.cursorPosition));
  }

  get cursorPosition(): TerminalCursorPosition {
    return this._stateSubject.value.cursorPosition;
  }

  updateCursorPosition(position: TerminalCursorPosition): void {
    this.updateState({ cursorPosition: position });
  }

  get mousePosition(): TerminalMousePosition {
    return this._stateSubject.value.mousePosition;
  }

  updateMousePosition(position: TerminalMousePosition): void {
    this.updateState({ mousePosition: position });
  }

  get dimensions(): TerminalDimensions {
    return this._stateSubject.value.dimensions;
  }

  updateDimensions(dimensions: TerminalDimensions): void {
    this.updateState({ dimensions });
  }

  get isFocused(): boolean {
    return this._stateSubject.value.isFocused;
  }

  get isFocused$(): Observable<boolean> {
    return this._stateSubject.pipe(map((s) => s.isFocused));
  }

  setFocus(focused: boolean): void {
    this.updateState({ isFocused: focused });
  }

  get hasSelection(): boolean {
    return this._stateSubject.value.hasSelection;
  }

  get hasSelection$(): Observable<boolean> {
    return this._stateSubject.pipe(map((s) => s.hasSelection));
  }

  setHasSelection(hasSelection: boolean): void {
    this.updateState({ hasSelection });
  }

  get isInFullScreenMode$(): Observable<boolean> {
    return this._stateSubject.pipe(map((s) => s.isInFullScreenMode));
  }

  setInFullScreenMode(fullSizeMode: boolean): void {
    this.updateState({ isInFullScreenMode: fullSizeMode });
  }

  get isPaneMaximized(): boolean {
    return this._stateSubject.value.isPaneMaximized;
  }

  get isPaneMaximized$(): Observable<boolean> {
    return this._stateSubject.pipe(map((s) => s.isPaneMaximized));
  }

  setPaneMaximized(isPaneMaximized: boolean): void {
    this.updateState({ isPaneMaximized });
  }

  get scrolledLinesFromBottom(): number {
    return this._stateSubject.value.scrolledLinesFromBottom;
  }

  get scrolledLinesFromBottom$(): Observable<number> {
    return this._stateSubject.pipe(map((s) => s.scrolledLinesFromBottom));
  }

  setScrolledLinesFromBottom(scrolledLinesFromBottom: number): void {
    this.updateState({ scrolledLinesFromBottom });
  }

  get hasUnreadNotification(): boolean {
    return this._stateSubject.value.hasUnreadNotification;
  }

  get hasUnreadNotification$(): Observable<boolean> {
    return this._stateSubject.pipe(map((s) => s.hasUnreadNotification));
  }

  markUnreadNotification(): void {
    if (!this.isTerminalNotificationBadgeEnabled()) {
      return;
    }
    this.updateState({ hasUnreadNotification: true });
  }

  clearUnreadNotification(): void {
    this.updateState({ hasUnreadNotification: false });
  }

  setProgress(state: TerminalProgressState, value: number): void {
    const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));
    this.updateState({
      progress: {
        state,
        value: state === "hidden" ? 0 : normalizedValue,
      },
    });
  }

  private isTerminalNotificationBadgeEnabled(): boolean {
    if (!this.configService) {
      return true;
    }
    try {
      const notificationConfig = this.configService.config.notification;
      return notificationConfig?.highlight_terminal_on_activity ?? true;
    } catch {
      return true;
    }
  }

  get isCommandRunning(): boolean {
    return this._stateSubject.value.isCommandRunning;
  }

  get isCommandRunning$(): Observable<boolean> {
    return this._stateSubject.pipe(map((s) => s.isCommandRunning));
  }

  startCommand(): void {
    const currentInput = this._stateSubject.value.input;

    this._historyStore.startCommand(currentInput.text);

    this.updateState({
      isCommandRunning: true,
      commandStartTime: Date.now(),
      input: { text: "", maxCursorIndex: 0, cursorIndex: 0 },
    });
    this.publishTerminalBusyChanged(true);
  }

  endCommand(): void {
    this.updateState({ isCommandRunning: false });
    this.publishTerminalBusyChanged(false);
  }

  getCommandDuration(): number | undefined {
    const startTime = this._stateSubject.value.commandStartTime;
    return startTime !== undefined ? Date.now() - startTime : undefined;
  }

  get input(): TerminalInput {
    return this._stateSubject.value.input;
  }

  get input$(): Observable<TerminalInput> {
    return this._stateSubject.pipe(map((s) => s.input));
  }

  updateInput(input: TerminalInput): void {
    this.updateState({ input });
  }

  get terminalId(): TerminalId {
    return this._stateSubject.value.terminalId;
  }

  get pathAdapter(): IPathAdapter | undefined {
    return this._pathAdapter;
  }

  renderPathForInsertion(path: string): string | undefined {
    if (!this._pathAdapter) {
      return undefined;
    }

    try {
      const normalizedPath = this._pathAdapter.normalize(path);
      return this._pathAdapter.render(normalizedPath, { purpose: "insert_arg" });
    } catch {
      return undefined;
    }
  }

  // ---- History Zugriff ----

  get commands$(): Observable<Command[]> {
    return this._historyStore.commands$;
  }

  get commands(): Command[] {
    return this._historyStore.commands;
  }

  updateCommand(data: Record<string, string>): ExecutedCommand | undefined {
    const executedCommand = this._historyStore.updateCommand(data);
    this._historyPersistence.onCommandExecuted(executedCommand);
    return executedCommand;
  }

  updateCommands(commands: Command[]): void {
    this._historyStore.updateCommands(commands);
  }

  updateCwd(cwd: string): void {
    const normalizedPath = this._pathAdapter?.normalize(cwd);
    const prevCwd = this._stateSubject.value.cwd;
    const normalizedPrevPath = prevCwd ? this._pathAdapter?.normalize(prevCwd) : "";
    const cwdChanged = normalizedPath !== normalizedPrevPath;

    this.updateState({ cwd });

    if (!normalizedPath) return;
    const backendOsPath = this._pathAdapter?.render(normalizedPath, { purpose: "backend_fs" });
    if (!backendOsPath) return;

    if (cwdChanged) {
      this._historyPersistence.onCwdChanged(cwd);
    }

    this._bus.publish({
      path: ["app", "terminal", this._stateSubject.value.terminalId],
      payload: { cwd: backendOsPath, terminalId: this._stateSubject.value.terminalId },
      type: "TerminalCwdChanged",
    });
  }

  private publishTerminalBusyChanged(isBusy: boolean): void {
    const terminalId = this._stateSubject.value.terminalId;
    if (!terminalId) {
      return;
    }

    this._bus.publish({
      path: ["app", "terminal"],
      type: "TerminalBusyChanged",
      payload: {
        terminalId,
        isBusy,
      },
    });
  }
}
