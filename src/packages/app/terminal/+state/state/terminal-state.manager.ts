// MIGRATION-TEMP(step 14): the state is split into MachineState (core/terminal)
// and SessionModel (core/session); this keeps the old single object and the
// old bus glue alive for the consumers in app/ until they move.
import { DestroyRef, Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { SessionCommandLog } from "@cogno/core/session/command-log/session-command-log";
import { Command, CommandData } from "@cogno/core/session/model/command.model";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { SessionModel, TerminalInput } from "@cogno/core/session/model/session-model";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { ExecutedCommand } from "@cogno/core/session/recorder/executed-command";
import { MachineState, TerminalProgressState } from "@cogno/core/terminal/machine-state";
import { OsPlatform } from "@cogno/platform/os";
import { ShellSessionCapabilitiesContract } from "@cogno/shared/contributions";
import { IPathAdapter } from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";
import { combineLatest, map, Observable, Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import {
  TerminalCursorPosition,
  TerminalDimensions,
  TerminalMousePosition,
  TerminalState,
} from "./terminal.state";

@Injectable()
export class TerminalStateManager {
  readonly machine = new MachineState();
  readonly model: SessionModel;
  private readonly subscription = new Subscription();
  private isDisposed = false;

  constructor(
    private readonly os: OsPlatform,
    private _bus: AppBus,
    historyStore: TerminalCommandHistoryStore = new TerminalCommandHistoryStore(),
    recorder: CommandRecorder = new CommandRecorder(new SessionCommandLog()),
    destroyRef?: DestroyRef,
    private configService?: ConfigService,
  ) {
    destroyRef?.onDestroy(() => this.dispose());
    this.model = new SessionModel(this.os.platform(), historyStore, recorder, () =>
      this.isTerminalNotificationBadgeEnabled(),
    );

    this.subscription.add(
      this.model.cwdReported$.subscribe((cwd) => {
        const terminalId = this.model.terminalId;
        this._bus.publish({
          path: ["app", "terminal", terminalId],
          payload: { cwd, terminalId },
          type: "TerminalCwdChanged",
        });
      }),
    );

    this.subscription.add(
      this.model.busy$.subscribe((isBusy) => {
        const terminalId = this.model.terminalId;
        if (!terminalId) return;
        this._bus.publish({
          path: ["app", "terminal"],
          type: "TerminalBusyChanged",
          payload: { terminalId, isBusy },
        });
      }),
    );

    this.subscription.add(
      this._bus.onType$("ConfigLoaded", { path: ["app", "settings"] }).subscribe(() => {
        if (!this.isTerminalNotificationBadgeEnabled()) {
          this.model.clearUnreadNotification();
        }
      }),
    );
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.model.dispose();
    this.subscription.unsubscribe();
  }

  initialize(terminalId: string, shellType: ShellType, shellProfile?: ShellProfile): void {
    this.model.initialize(terminalId, shellType, shellProfile, this.os.platform());
  }

  private isTerminalNotificationBadgeEnabled(): boolean {
    if (!this.configService) return true;
    try {
      return this.configService.config.terminal?.notifications?.unread_badge ?? true;
    } catch {
      return true;
    }
  }

  // ---- both halves as one -----------------------------------------------

  get state$(): Observable<TerminalState> {
    return combineLatest([this.machine.state$, this.model.state$]).pipe(
      map(([machine, model]) => ({ ...machine, ...model })),
    );
  }

  get state(): TerminalState {
    return { ...this.machine.state, ...this.model.state };
  }

  // ---- machine ----------------------------------------------------------

  get cursorPosition$(): Observable<TerminalCursorPosition> {
    return this.machine.cursorPosition$;
  }
  get cursorPosition(): TerminalCursorPosition {
    return this.machine.cursorPosition;
  }
  updateCursorPosition(position: TerminalCursorPosition): void {
    this.machine.updateCursorPosition(position);
  }
  get mousePosition(): TerminalMousePosition {
    return this.machine.mousePosition;
  }
  updateMousePosition(position: TerminalMousePosition): void {
    this.machine.updateMousePosition(position);
  }
  get dimensions(): TerminalDimensions {
    return this.machine.dimensions;
  }
  updateDimensions(dimensions: TerminalDimensions): void {
    this.machine.updateDimensions(dimensions);
  }
  get isFocused(): boolean {
    return this.machine.isFocused;
  }
  get isFocused$(): Observable<boolean> {
    return this.machine.isFocused$;
  }
  setFocus(focused: boolean): void {
    this.machine.setFocus(focused);
  }
  get hasSelection(): boolean {
    return this.machine.hasSelection;
  }
  get hasSelection$(): Observable<boolean> {
    return this.machine.hasSelection$;
  }
  setHasSelection(hasSelection: boolean): void {
    this.machine.setHasSelection(hasSelection);
  }
  get isInFullScreenMode$(): Observable<boolean> {
    return this.machine.isInFullScreenMode$;
  }
  setInFullScreenMode(fullSizeMode: boolean): void {
    this.machine.setInFullScreenMode(fullSizeMode);
  }
  get scrolledLinesFromBottom(): number {
    return this.machine.scrolledLinesFromBottom;
  }
  get scrolledLinesFromBottom$(): Observable<number> {
    return this.machine.scrolledLinesFromBottom$;
  }
  setScrolledLinesFromBottom(scrolledLinesFromBottom: number): void {
    this.machine.setScrolledLinesFromBottom(scrolledLinesFromBottom);
  }
  setProgress(state: TerminalProgressState, value: number): void {
    this.machine.setProgress(state, value);
  }

  // ---- session ----------------------------------------------------------

  get terminalId(): TerminalId {
    return this.model.terminalId;
  }
  get pathAdapter(): IPathAdapter | undefined {
    return this.model.pathAdapter;
  }
  renderPathForInsertion(path: string): string | undefined {
    return this.model.renderPathForInsertion(path);
  }
  get isCommandRunning(): boolean {
    return this.model.isCommandRunning;
  }
  get isCommandRunning$(): Observable<boolean> {
    return this.model.isCommandRunning$;
  }
  startCommand(overrideInputText?: string): void {
    this.model.startCommand(overrideInputText);
  }
  endCommand(): void {
    this.model.endCommand();
  }
  getCommandDuration(): number | undefined {
    return this.model.getCommandDuration();
  }
  get sessionCapabilities(): ShellSessionCapabilitiesContract | undefined {
    return this.model.sessionCapabilities;
  }
  get sessionCapabilities$(): Observable<ShellSessionCapabilitiesContract | undefined> {
    return this.model.sessionCapabilities$;
  }
  updateSessionCapabilities(sessionCapabilities: ShellSessionCapabilitiesContract): void {
    this.model.updateSessionCapabilities(sessionCapabilities);
  }
  get input(): TerminalInput {
    return this.model.input;
  }
  get input$(): Observable<TerminalInput> {
    return this.model.input$;
  }
  updateInput(input: TerminalInput): void {
    this.model.updateInput(input);
  }
  updateCwd(cwd: string): void {
    this.model.updateCwd(cwd);
  }
  get commands$(): Observable<Command[]> {
    return this.model.commands$;
  }
  get commands(): Command[] {
    return this.model.commands;
  }
  updateCommand(data: CommandData): ExecutedCommand | undefined {
    return this.model.updateCommand(data);
  }
  updateCommands(commands: Command[]): void {
    this.model.updateCommands(commands);
  }
  get hasUnreadNotification(): boolean {
    return this.model.hasUnreadNotification;
  }
  get hasUnreadNotification$(): Observable<boolean> {
    return this.model.hasUnreadNotification$;
  }
  markUnreadNotification(): void {
    this.model.markUnreadNotification();
  }
  clearUnreadNotification(): void {
    this.model.clearUnreadNotification();
  }
  get isPaneMaximized(): boolean {
    return this.model.isPaneMaximized;
  }
  get isPaneMaximized$(): Observable<boolean> {
    return this.model.isPaneMaximized$;
  }
  setPaneMaximized(isPaneMaximized: boolean): void {
    this.model.setPaneMaximized(isPaneMaximized);
  }
}
