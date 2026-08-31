import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { OsType } from "@cogno/platform/os";
import { ShellSessionCapabilitiesContract } from "@cogno/shared/contributions";
import { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";
import { BehaviorSubject, map, Observable, Subject } from "rxjs";
import { CommandRecorder } from "../recorder/command-recorder";
import type { SessionFact } from "../session-facts";
import { createPathAdapter } from "../shells/shell-definitions";
import { Command, CommandData } from "./command.model";
import { ExecutedCommand, TerminalCommandHistoryStore } from "./command-history.store";
import { deriveShellContext } from "./shell-context";

export type TerminalInput = {
  cursorIndex: number;
  maxCursorIndex: number;
  text: string;
};

/** What the session knows about itself. */
export type SessionModelSnapshot = {
  terminalId: string;
  shellContext: ResolvedShellContextContract;
  cwd: string;
  input: TerminalInput;
  isCommandRunning: boolean;
  commandStartTime: number | undefined;
  /**
   * Capabilities reported by the session's shell integration via the
   * COGNO:CAPS handshake; undefined until (and unless) the handshake arrives.
   */
  sessionCapabilities: ShellSessionCapabilitiesContract | undefined;
  hasUnreadNotification: boolean;
  isPaneMaximized: boolean;
};

export const createInitialSessionState = (backendOs: OsType): SessionModelSnapshot => ({
  terminalId: "",
  shellContext: { shellType: "Bash", backendOs },
  cwd: "",
  input: { cursorIndex: 0, maxCursorIndex: 0, text: "" },
  isCommandRunning: false,
  commandStartTime: undefined,
  sessionCapabilities: undefined,
  hasUnreadNotification: false,
  isPaneMaximized: false,
});

/**
 * The session's half of what used to be one state manager: which shell runs
 * in which context, where it is, what is typed, whether a command runs, what
 * the integration can do, and the commands so far. It feeds the recorder and
 * states what happened as facts on `facts$`, without knowing who listens
 * (ARCHITECTURE.md 2.1).
 *
 * The unread badge and pane maximization sit here for now because they die
 * with the session; maximization is workbench business and moves there.
 */
export class SessionModel {
  private readonly _state: BehaviorSubject<SessionModelSnapshot>;
  private readonly _facts = new Subject<SessionFact>();
  private _pathAdapter?: IPathAdapter;

  constructor(
    backendOs: OsType,
    private readonly _historyStore: TerminalCommandHistoryStore,
    private readonly _recorder: CommandRecorder,
    /** Read at the moment a badge would be set, so a config change applies at once. */
    private readonly _isUnreadBadgeEnabled: () => boolean = () => true,
  ) {
    this._state = new BehaviorSubject<SessionModelSnapshot>(createInitialSessionState(backendOs));
  }

  /** What happened in this session, in order. */
  get facts$(): Observable<SessionFact> {
    return this._facts.asObservable();
  }

  /** States a fact. Session code calls this; nothing outside the session does. */
  report(fact: SessionFact): void {
    this._facts.next(fact);
  }

  initialize(
    terminalId: string,
    shellType: ShellType,
    shellProfile: ShellProfile | undefined,
    backendOs: OsType,
  ): void {
    const shellContext = deriveShellContext(shellType, shellProfile, backendOs);
    this._pathAdapter = createPathAdapter(shellContext);
    this._recorder.initialize(shellContext, this._pathAdapter, terminalId);
    this.update({ terminalId, shellContext, isPaneMaximized: false });
  }

  dispose(): void {
    this.report({ type: "busyChanged", isBusy: false });
    this._facts.complete();
  }

  get state$(): Observable<SessionModelSnapshot> {
    return this._state.asObservable();
  }

  get state(): SessionModelSnapshot {
    return this._state.value;
  }

  get terminalId(): TerminalId {
    return this._state.value.terminalId;
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

  // ---- command ----------------------------------------------------------

  get isCommandRunning(): boolean {
    return this._state.value.isCommandRunning;
  }

  get isCommandRunning$(): Observable<boolean> {
    return this._state.pipe(map((s) => s.isCommandRunning));
  }

  /**
   * `overrideInputText` lets programmatic submitters (history auto-execute,
   * composer, autocomplete) pass the text they are about to submit: unlike a
   * real Enter keypress, their state update hasn't gone through the terminal
   * echo yet, so `input.text` here would still be stale.
   */
  startCommand(overrideInputText?: string): void {
    const currentInput = this._state.value.input;

    this._historyStore.startCommand(overrideInputText ?? currentInput.text);

    this.update({
      isCommandRunning: true,
      commandStartTime: Date.now(),
      input: { text: "", maxCursorIndex: 0, cursorIndex: 0 },
    });
    this.report({ type: "busyChanged", isBusy: true });
  }

  endCommand(): void {
    this.update({ isCommandRunning: false });
    this.report({ type: "busyChanged", isBusy: false });
  }

  getCommandDuration(): number | undefined {
    const startTime = this._state.value.commandStartTime;
    return startTime !== undefined ? Date.now() - startTime : undefined;
  }

  // ---- input and capabilities --------------------------------------------

  get input(): TerminalInput {
    return this._state.value.input;
  }

  get input$(): Observable<TerminalInput> {
    return this._state.pipe(map((s) => s.input));
  }

  updateInput(input: TerminalInput): void {
    this.update({ input });
  }

  get sessionCapabilities(): ShellSessionCapabilitiesContract | undefined {
    return this._state.value.sessionCapabilities;
  }

  get sessionCapabilities$(): Observable<ShellSessionCapabilitiesContract | undefined> {
    return this._state.pipe(map((s) => s.sessionCapabilities));
  }

  updateSessionCapabilities(sessionCapabilities: ShellSessionCapabilitiesContract): void {
    this.update({ sessionCapabilities });
  }

  // ---- working directory ------------------------------------------------

  updateCwd(cwd: string): void {
    const normalizedPath = this._pathAdapter?.normalize(cwd);
    const storedCwd = normalizedPath ?? cwd;
    const cwdChanged = storedCwd !== this._state.value.cwd;

    this.update({ cwd: storedCwd });

    if (!normalizedPath) return;
    const backendOsPath = this._pathAdapter?.render(normalizedPath, { purpose: "backend_fs" });
    if (!backendOsPath) return;

    if (cwdChanged) {
      this._recorder.onCwdChanged(normalizedPath);
    }

    this.report({ type: "cwdReported", cwd: backendOsPath });
  }

  // ---- commands so far --------------------------------------------------

  get commands$(): Observable<Command[]> {
    return this._historyStore.commands$;
  }

  get commands(): Command[] {
    return this._historyStore.commands;
  }

  updateCommand(data: CommandData): ExecutedCommand | undefined {
    const executedCommand = this._historyStore.updateCommand(data);
    this._recorder.onCommandExecuted(executedCommand);
    if (executedCommand) {
      this.report({ type: "commandCompleted", command: executedCommand });
    }
    return executedCommand;
  }

  updateCommands(commands: Command[]): void {
    this._historyStore.updateCommands(commands);
  }

  // ---- badge and pane ---------------------------------------------------

  get hasUnreadNotification(): boolean {
    return this._state.value.hasUnreadNotification;
  }

  get hasUnreadNotification$(): Observable<boolean> {
    return this._state.pipe(map((s) => s.hasUnreadNotification));
  }

  markUnreadNotification(): void {
    if (!this._isUnreadBadgeEnabled()) return;
    if (this._state.value.hasUnreadNotification) return;
    this.update({ hasUnreadNotification: true });
  }

  clearUnreadNotification(): void {
    // Called on every keystroke via terminal.onData - skip the state emission
    // when nothing changes, otherwise every subscriber runs per keypress.
    if (!this._state.value.hasUnreadNotification) return;
    this.update({ hasUnreadNotification: false });
  }

  get isPaneMaximized(): boolean {
    return this._state.value.isPaneMaximized;
  }

  get isPaneMaximized$(): Observable<boolean> {
    return this._state.pipe(map((s) => s.isPaneMaximized));
  }

  setPaneMaximized(isPaneMaximized: boolean): void {
    this.update({ isPaneMaximized });
  }

  private update(updates: Partial<SessionModelSnapshot>): void {
    this._state.next({ ...this._state.value, ...updates });
  }
}
