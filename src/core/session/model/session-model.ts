import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { OsType } from "@cogno/platform/os";
import { ShellSessionCapabilitiesContract } from "@cogno/shared/contributions";
import { IPathAdapter, ResolvedShellContextContract, TerminalId } from "@cogno/shared/domain";
import { BehaviorSubject, map, Observable, Subject } from "rxjs";
import { CommandRecorder } from "../recorder/command-recorder";
import type { SessionFact } from "../session-facts";
import { createPathAdapter } from "../shells/shell-definitions";
import { Command, CommandData } from "./command.model";
import { ExecutedCommand, TerminalCommandHistoryStore } from "./command-history.store";
import { contextFromHandshake, deriveShellContext } from "./shell-context";

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
  /**
   * The context timeline's current entry (ARCHITECTURE.md 2.1, "Das
   * Sitzungsmodell ist veränderlich"). `contextRevision` rises on every
   * push and pop, so a feature that planned against one context can tell it
   * has moved on. `isContextKnown` is false in a foreign shell whose
   * integration did not authenticate - path translation, editor actions and
   * recording degrade visibly there rather than guess.
   */
  contextRevision: number;
  isContextKnown: boolean;
  hasUnreadNotification: boolean;
  isPaneMaximized: boolean;
};

const createInitialSessionState = (backendOs: OsType): SessionModelSnapshot => ({
  terminalId: "",
  shellContext: { shellType: "Bash", backendOs },
  cwd: "",
  input: { cursorIndex: 0, maxCursorIndex: 0, text: "" },
  isCommandRunning: false,
  commandStartTime: undefined,
  sessionCapabilities: undefined,
  contextRevision: 0,
  isContextKnown: true,
  hasUnreadNotification: false,
  isPaneMaximized: false,
});

/** One entry of the context timeline: what the shell is, and what it can do. */
type ContextEntry = {
  /** The resolved shell context; undefined means an unauthenticated foreign shell. */
  readonly context: ResolvedShellContextContract | undefined;
  readonly capabilities: ShellSessionCapabilitiesContract | undefined;
  readonly pathAdapter: IPathAdapter | undefined;
  readonly revision: number;
};

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
/** Dropped impostor sequences before the session says so once. */
const UNTRUSTED_SEQUENCES_THRESHOLD = 3;

export class SessionModel {
  private readonly _state: BehaviorSubject<SessionModelSnapshot>;
  private readonly _facts = new Subject<SessionFact>();
  /** The context timeline; the base context is always entry 0 (ARCHITECTURE.md 2.1). */
  private _contextStack: ContextEntry[] = [];
  private _nextRevision = 1;
  private _sessionToken?: string;
  private _untrustedSequenceCount = 0;
  private _isRestoring = false;

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

  /**
   * The secret this session's integration scripts echo back in every
   * model-changing sequence. Set before the shell spawns; while unset (old
   * scripts, tests without a spawn) sequences are accepted unverified.
   */
  setSessionToken(token: string): void {
    this._sessionToken = token;
  }

  get sessionToken(): string | undefined {
    return this._sessionToken;
  }

  /**
   * While a session snapshot is being replayed into the buffer, the observer
   * must not mirror the replayed text as the current input line: it is dead
   * scrollback, not something the user typed (step 27). The replay writes no
   * OSC/CSI, so nothing else on the write path reacts.
   */
  beginRestore(): void {
    this._isRestoring = true;
  }

  endRestore(): void {
    this._isRestoring = false;
  }

  get isRestoring(): boolean {
    return this._isRestoring;
  }

  /** A Cogno sequence without this session's token was dropped. */
  recordUntrustedSequence(): void {
    this._untrustedSequenceCount += 1;
    if (this._untrustedSequenceCount === UNTRUSTED_SEQUENCES_THRESHOLD) {
      this.report({ type: "untrustedSequencesIgnored", count: this._untrustedSequenceCount });
    }
  }

  get untrustedSequenceCount(): number {
    return this._untrustedSequenceCount;
  }

  initialize(
    terminalId: string,
    shellType: ShellType,
    shellProfile: ShellProfile | undefined,
    backendOs: OsType,
  ): void {
    const shellContext = deriveShellContext(shellType, shellProfile, backendOs);
    const pathAdapter = createPathAdapter(shellContext);
    this._contextStack = [
      { context: shellContext, capabilities: undefined, pathAdapter, revision: 0 },
    ];
    this._recorder.initialize(shellContext, pathAdapter, terminalId);
    this.update({
      terminalId,
      shellContext,
      contextRevision: 0,
      isContextKnown: true,
      isPaneMaximized: false,
    });
  }

  // ---- context timeline -------------------------------------------------

  private get currentContextEntry(): ContextEntry | undefined {
    return this._contextStack[this._contextStack.length - 1];
  }

  /** Whether the session is in its original context (entry 0), where it records. */
  private get isBaseContext(): boolean {
    return this._contextStack.length === 1;
  }

  /** The nearest known context from the top down; the base is always known. */
  private currentKnownContext(): ResolvedShellContextContract {
    for (let i = this._contextStack.length - 1; i >= 0; i--) {
      const context = this._contextStack[i].context;
      if (context) return context;
    }
    return this._state.value.shellContext;
  }

  /**
   * A trusted `COGNO:CAPS` handshake. While a command runs it is a new inner
   * context (`wsl`, `ssh` with the integration installed and the token
   * forwarded); otherwise it re-handshakes the current context - the boot
   * handshake, or an `exec` that replaced the shell in place.
   */
  applyHandshake(
    capabilities: ShellSessionCapabilitiesContract,
    fields: { shell?: string; os?: string; distro?: string },
  ): void {
    const context = contextFromHandshake(fields, this.currentKnownContext());
    const entry: ContextEntry = {
      context,
      capabilities,
      pathAdapter: context ? createPathAdapter(context) : undefined,
      revision: this._nextRevision++,
    };
    // Push only for a genuinely nested known context - a handshake inside a
    // shell that already authenticated. Otherwise replace the current entry:
    // the command that ran (`wsl`, `ssh`) had degraded to an unknown context
    // and its inner shell now authenticates (same level, resolved, so the one
    // returning prompt unwinds the whole command), or it is the boot handshake
    // or an `exec` that replaced the shell in place.
    if (this.isCommandRunning && this.currentContextEntry?.context !== undefined) {
      this._contextStack.push(entry);
    } else {
      this._contextStack[this._contextStack.length - 1] = entry;
    }
    this.syncContext();
  }

  /**
   * A running command left the known context without an authenticated
   * handshake (`ssh`/`wsl` into a host that has no integration, or has it but
   * did not forward the token). Everything context-bound degrades until the
   * command ends (ARCHITECTURE.md 4.3, not 4.4 - visible, not guessed).
   */
  enterUnknownContext(): void {
    this._contextStack.push({
      context: undefined,
      capabilities: undefined,
      pathAdapter: undefined,
      revision: this._nextRevision++,
    });
    this.syncContext();
  }

  /** The command that opened an inner context ended; the outer context is back. */
  private popContextOnCommandEnd(): void {
    if (this._contextStack.length <= 1) return;
    this._contextStack.pop();
    this._nextRevision++;
    this.syncContext();
  }

  private syncContext(): void {
    const entry = this.currentContextEntry;
    this.update({
      shellContext: this.currentKnownContext(),
      sessionCapabilities: entry?.capabilities,
      contextRevision: entry?.revision ?? 0,
      isContextKnown: entry?.context !== undefined,
    });
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
    return this.currentContextEntry?.pathAdapter;
  }

  renderPathForInsertion(path: string): string | undefined {
    const pathAdapter = this.pathAdapter;
    if (!pathAdapter) {
      return undefined;
    }

    try {
      const normalizedPath = pathAdapter.normalize(path);
      return pathAdapter.render(normalizedPath, { purpose: "insert_arg" });
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

    const commandText = overrideInputText ?? currentInput.text;
    this.update({
      isCommandRunning: true,
      commandStartTime: Date.now(),
      input: { text: "", maxCursorIndex: 0, cursorIndex: 0 },
    });
    this.report({ type: "busyChanged", isBusy: true });
    if (this.isBaseContext && leavesTheKnownContext(commandText)) {
      // ssh/wsl take the shell somewhere Cogno cannot resolve unless the
      // inner shell authenticates; until then, degrade.
      this.enterUnknownContext();
    }
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

  /** Ends the current command's context if it opened one; then the prompt is the outer shell's. */
  onPromptBeforeCommandEnd(): void {
    this.popContextOnCommandEnd();
  }

  // ---- working directory ------------------------------------------------

  updateCwd(cwd: string): void {
    const pathAdapter = this.pathAdapter;
    const normalizedPath = pathAdapter?.normalize(cwd);
    const storedCwd = normalizedPath ?? cwd;
    const cwdChanged = storedCwd !== this._state.value.cwd;

    this.update({ cwd: storedCwd });

    if (!normalizedPath) return;
    const backendOsPath = pathAdapter?.render(normalizedPath, { purpose: "backend_fs" });
    if (!backendOsPath) return;

    if (cwdChanged && this.isBaseContext) {
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
    if (this.isBaseContext) {
      this._recorder.onCommandExecuted(executedCommand);
    }
    if (executedCommand) {
      this.report({ type: "commandCompleted", command: executedCommand });
    }
    return executedCommand;
  }

  /**
   * A command still running when the app quits is recorded as an aborted entry so
   * it isn't lost from history - it never reported a return code (step 27b-2).
   * Only base-context commands are logged, mirroring `updateCommand`. Awaited so
   * it reaches the log before the process exits.
   */
  async recordAbortedCommand(): Promise<void> {
    if (!this.isCommandRunning || !this.isBaseContext) {
      return;
    }
    const runningCommand = this.commands.at(-1);
    if (!runningCommand?.command) {
      return;
    }
    await this._recorder.recordAbortedCommand({
      command: runningCommand.command,
      directory: runningCommand.directory ?? "",
      duration: this.getCommandDuration(),
      returnCode: undefined,
    });
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

const CONTEXT_CHANGING_COMMANDS = new Set(["ssh", "wsl"]);

/** True when the command's program takes the shell into a context Cogno cannot resolve. */
function leavesTheKnownContext(commandText: string): boolean {
  const program = commandText.trim().split(/\s+/, 1)[0];
  return CONTEXT_CHANGING_COMMANDS.has(program);
}
