import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { CursorHandler } from "@cogno/core/terminal/handlers/cursor.handler";
import { FocusHandler } from "@cogno/core/terminal/handlers/focus.handler";
import { MouseHandler } from "@cogno/core/terminal/handlers/mouse.handler";
import { PtyHandler } from "@cogno/core/terminal/handlers/pty.handler";
import { ResizeHandler } from "@cogno/core/terminal/handlers/resize.handler";
import { ScrollStateHandler } from "@cogno/core/terminal/handlers/scroll-state.handler";
import { SelectionHandler } from "@cogno/core/terminal/handlers/selection.handler";
import { MachineState, MachineStateSnapshot } from "@cogno/core/terminal/machine-state";
import { IPty, Pty } from "@cogno/core/terminal/pty";
import { IRenderer, Renderer } from "@cogno/core/terminal/renderer";
import { Opener, OsPlatform, PtyTransport } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { ProcessTreeSnapshot, TauriPty } from "@cogno/platform/pty";
import {
  ShellLineEditorActionContract,
  ShellSessionCapabilitiesContract,
} from "@cogno/shared/contributions";
import {
  TerminalId,
  TerminalSearchRequestContract,
  TerminalSearchRevealRequestContract,
} from "@cogno/shared/domain";
import { IDisposable } from "@cogno/shared/support";
import { ContextMenuItem, ContextMenuOverlayService } from "@cogno/shared/ui";
import {
  BehaviorSubject,
  combineLatest,
  map,
  merge,
  Observable,
  Subject,
  Subscription,
} from "rxjs";
import { CommandBlockResolver } from "../decoration/command-block-resolver";
import { buildCommandMenuItems, CommandMenuBlockRange } from "../decoration/command-menu-items";
import { PromptMarkerRegistry } from "../decoration/prompt-marker.registry";
import { CommandLineEditor } from "../editor/command-line.editor";
import { TerminalInputWriter } from "../editor/input-writer";
import { ClipboardHandler } from "../handlers/clipboard.handler";
import { FullScreenAppHandler } from "../handlers/full-screen-app.handler";
import { InputHandler } from "../handlers/input.handler";
import { LinkHandler } from "../handlers/link.handler";
import { ResumeLinkHandler } from "../handlers/resume-link.handler";
import { TerminalNotificationHandler } from "../handlers/terminal-notification.handler";
import { TerminalPaddingHandler } from "../handlers/terminal-padding.handler";
import { TerminalSearchHandler } from "../handlers/terminal-search.handler";
import { TerminalTitleHandler } from "../handlers/terminal-title.handler";
import { Command } from "../model/command.model";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import { CommandLineBuffer } from "../model/command-line.buffer";
import { CommandLineObserver } from "../model/command-line.observer";
import { SessionModel, SessionModelSnapshot, TerminalInput } from "../model/session-model";
import { CommandRecorder } from "../recorder/command-recorder";
import { SessionFact } from "../session-facts";
import { shellDefinitions } from "../shells/shell-definitions";
import { serializeScrollback } from "./scrollback-serializer";
/** Both halves of a session's state as one read-only view. */
import {
  type CommandSnapshot,
  SESSION_SNAPSHOT_VERSION,
  type SessionSnapshot,
} from "./session-snapshot";
import { toTerminalMachineOptions } from "./terminal-machine-options.mapper";

export type SessionState = MachineStateSnapshot & SessionModelSnapshot;

/** The concealed prompt marker line the shell integration prints (`^^#<id>`). */
const MARKER_ID_PATTERN = /\^\^#(\d+)/g;
/**
 * Shift restored marker ids past any the live session will mint. bash/zsh count
 * from 1 each session, so without this a restored `^^#1` would collide with the
 * new `^^#1` and the registry would drop the live marker; PowerShell uses epoch
 * timestamps, which stay well below this bound for millennia (step 27).
 */
const RESTORED_MARKER_ID_OFFSET = 1_000_000_000_000_000;

function offsetMarkerId(id: string): string {
  const numeric = Number(id);
  return Number.isFinite(numeric) ? String(numeric + RESTORED_MARKER_ID_OFFSET) : id;
}

/**
 * Axis A - runtime (ARCHITECTURE.md 2.3). `allocated` until started;
 * `starting` while the shell spawns; `running` once it does, `failed` with
 * a reason when it does not. A running shell either `exited` on its own or
 * is `closing` because the workbench said so; both end in `closed`.
 */
export type SessionRuntimeStatus =
  | "allocated"
  | "starting"
  | "running"
  | "failed"
  | "exited"
  | "closing"
  | "closed";

export type SessionRuntime = {
  readonly status: SessionRuntimeStatus;
  /** Why the start failed; only while `failed`. */
  readonly reason?: string;
  /** How the shell ended; only from `exited` on. */
  readonly exitCode?: number;
};

/** Axis B - display: whether the machine is in the DOM right now. */
export type SessionDisplay = "detached" | "attached";

type ContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openAtElement">;

/** How long after the shell answered the terminal takes the keyboard. */
const FOCUS_AFTER_START_MS = 50;
/** Padding and theme changes settle before the terminal is measured again. */
const RESIZE_AFTER_LAYOUT_CHANGE_MS = 100;

/**
 * One running session: owns the machine (pty, renderer), the model, the
 * recorder and every handler, and composes them. It states facts on
 * `facts$` and offers methods; it holds no bus and knows nothing about
 * panes, tabs or the workbench (ARCHITECTURE.md 2.3).
 *
 * Two axes, independent of each other: the runtime (`start`, `retry`,
 * `close`) and the display (`attach`, `detach`). The shell runs and the
 * model is kept whether or not the terminal is on screen; `detach` never
 * ends a session, only `close` does.
 */
export class SessionHost {
  readonly machine = new MachineState();
  readonly model: SessionModel;

  private readonly renderer: IRenderer;
  private readonly pty: IPty;
  private readonly hostFacts = new Subject<SessionFact>();
  private readonly runtime$$ = new BehaviorSubject<SessionRuntime>({ status: "allocated" });
  private readonly display$$ = new BehaviorSubject<SessionDisplay>("detached");
  private readonly subscription = new Subscription();
  private readonly disposables: IDisposable[] = [];
  private readonly commandBlockResolver: CommandBlockResolver;

  private _terminalId?: TerminalId;
  private _shellProfile?: ShellProfile;
  /** The element the machine renders into; created on the first attach. */
  private hostElement?: HTMLDivElement;
  private ptyHandler?: PtyHandler;
  private resizeHandler?: ResizeHandler;
  private focusHandler?: FocusHandler;
  private selectionHandler?: SelectionHandler;
  private inputHandler?: InputHandler;
  private clipboardHandler?: ClipboardHandler;
  private searchHandler?: TerminalSearchHandler;
  private editor?: CommandLineEditor;
  private promptMarkerRegistry?: PromptMarkerRegistry;
  /** A snapshot waiting to be replayed on the first attach (step 27). */
  private _pendingRestore?: SessionSnapshot;
  private _restoreScheduled = false;

  constructor(
    private readonly os: OsPlatform,
    environment: Environment,
    private readonly clipboard: ClipboardAccess,
    private readonly configService: ConfigService,
    private readonly opener: Opener,
    private readonly contextMenuOverlay: ContextMenuOverlayPort,
    ptyTransport: PtyTransport,
    historyStore: TerminalCommandHistoryStore,
    recorder: CommandRecorder,
  ) {
    this.model = new SessionModel(this.os.platform(), historyStore, recorder, () =>
      this.isUnreadBadgeEnabled(),
    );
    this.pty = new Pty(ptyTransport, environment.isDevMode());
    this.renderer = new Renderer(
      toTerminalMachineOptions(this.configService.config),
      this.os.platform(),
    );
    // The machine reports faults, it does not handle them: the host decides
    // who hears about it (ARCHITECTURE.md 2.1, boundary decision 2).
    this.subscription.add(
      this.pty.faults$.subscribe((fault) =>
        ErrorReporter.reportException({
          error: fault.error,
          handled: true,
          source: "Pty",
          context: { operation: fault.operation, ...fault.context },
        }),
      ),
    );
    this.commandBlockResolver = new CommandBlockResolver(() => this.renderer.terminal);
  }

  // ---- what the session says and shows --------------------------------

  /** What happened in this session, in order: the model's facts and the host's own. */
  get facts$(): Observable<SessionFact> {
    return merge(this.model.facts$, this.hostFacts.asObservable());
  }

  get runtime(): SessionRuntime {
    return this.runtime$$.value;
  }

  get runtime$(): Observable<SessionRuntime> {
    return this.runtime$$.asObservable();
  }

  get display(): SessionDisplay {
    return this.display$$.value;
  }

  get display$(): Observable<SessionDisplay> {
    return this.display$$.asObservable();
  }

  get terminalId(): TerminalId | undefined {
    return this._terminalId;
  }

  get shellProfile(): ShellProfile | undefined {
    return this._shellProfile;
  }

  get state(): SessionState {
    return { ...this.machine.state, ...this.model.state };
  }

  get state$(): Observable<SessionState> {
    return combineLatest([this.machine.state$, this.model.state$]).pipe(
      map(([machine, model]) => ({ ...machine, ...model })),
    );
  }

  get isFocused(): boolean {
    return this.machine.isFocused;
  }

  get hasSelection(): boolean {
    return this.machine.hasSelection;
  }

  get isCommandRunning(): boolean {
    return this.model.isCommandRunning;
  }

  get input(): TerminalInput {
    return this.model.input;
  }

  get sessionCapabilities(): ShellSessionCapabilitiesContract | undefined {
    return this.model.sessionCapabilities;
  }

  get isWebglContextLost$(): Observable<boolean> {
    return this.renderer.isWebglContextLost$;
  }

  // ---- axis A: runtime ---------------------------------------------------

  initialize(terminalId: TerminalId, shellProfile: ShellProfile): void {
    if (!shellProfile.shell_type) {
      throw new Error("Shell profile must define a shell type.");
    }
    this._terminalId = terminalId;
    this._shellProfile = shellProfile;
    this.model.initialize(terminalId, shellProfile.shell_type, shellProfile, this.os.platform());
  }

  /**
   * Spawns the shell and wires everything that works without a DOM: the
   * core parses, the markers anchor, the model lives - on screen or not.
   */
  start(): void {
    const terminalId = this._terminalId;
    const shellProfile = this._shellProfile;
    if (!terminalId || !shellProfile) {
      throw new Error("SessionHost must be initialized before start");
    }
    if (this.runtime.status !== "allocated") return;
    this.setRuntime({ status: "starting" });

    // The session's secret: the integration scripts echo it back in every
    // model-changing OSC sequence, so output content cannot impersonate
    // them. Created here, before the first byte can arrive.
    const sessionToken = createSessionToken();
    this.model.setSessionToken(sessionToken);
    const spawnProfile: ShellProfile = {
      ...shellProfile,
      env: { ...shellProfile.env, COGNO_SESSION_TOKEN: sessionToken },
    };

    // The machine takes values; reading the config and pushing them again
    // when it changes is the host's job (ARCHITECTURE.md 2.1). A theme
    // change alters the usable area, so the terminal is measured again.
    this.subscription.add(
      this.configService.config$.subscribe((config) => {
        this.renderer.setOptions(toTerminalMachineOptions(config));
        if (!this.isUnreadBadgeEnabled()) {
          this.model.clearUnreadNotification();
        }
        this.resizeSoon();
      }),
    );
    this.subscription.add(
      this.model.facts$.subscribe((fact) => {
        if (fact.type === "paddingChanged") this.resizeSoon();
      }),
    );

    this.ptyHandler = new PtyHandler(terminalId, this.pty, spawnProfile, {
      onSpawned: () => this.setRuntime({ status: "running" }),
      onFailed: (error) => this.onStartFailed(error),
      onStarted: (shellType) => {
        this.hostFacts.next({ type: "started", shellType });
        setTimeout(() => this.focus(), FOCUS_AFTER_START_MS);
      },
      onExited: (exitCode) => {
        this.setRuntime({ status: "exited", exitCode });
        this.hostFacts.next({ type: "exited", exitCode });
      },
      onOutput: () => this.hostFacts.next({ type: "outputReceived" }),
    });
    // A restored session defers the shell spawn to its first attach: the saved
    // scrollback must be written into an open, final-sized terminal before the
    // shell (ConPTY on Windows especially) paints, so it paints below the
    // scrollback, not over it. Everything else is wired now (step 27).
    if (!this._pendingRestore) {
      this.disposables.push(this.renderer.register(this.ptyHandler));
    }

    this.focusHandler = new FocusHandler((focused) => this.onFocusChanged(focused));
    this.disposables.push(this.renderer.register(new TerminalTitleHandler(this.model)));
    this.disposables.push(
      this.renderer.register(new TerminalNotificationHandler(this.model, this.machine)),
    );
    this.disposables.push(
      this.renderer.register(new FullScreenAppHandler(this.model, this.machine)),
    );
    this.disposables.push(this.renderer.register(this.focusHandler));
    this.selectionHandler = new SelectionHandler(this.machine);
    this.disposables.push(this.renderer.register(this.selectionHandler));
    this.searchHandler = new TerminalSearchHandler(this.model, this.configService);
    this.disposables.push(this.renderer.register(this.searchHandler));
    this.disposables.push(this.renderer.register(new CursorHandler(this.machine)));
    this.disposables.push(this.renderer.register(new ScrollStateHandler(this.machine)));
    this.disposables.push(
      this.renderer.register(new LinkHandler(this.clipboard, this.model, this.opener, this.os)),
    );
    this.disposables.push(
      this.renderer.register(new ResumeLinkHandler(this.clipboard, this.pty, this.os)),
    );

    const shellDefinition = shellProfile.enable_shell_integration
      ? shellDefinitions.find(
          (definition) => definition.support.shellType === shellProfile.shell_type,
        )
      : undefined;

    // Shared prompt-marker positions, buffer reads and input writes: the
    // observer anchors/maintains the markers, the editor and clipboard
    // handler read them for selection math and share one pty-writing path. A
    // single instance per session keeps them consistent after a `clear` or
    // reflow.
    const promptMarkerRegistry = new PromptMarkerRegistry();
    this.promptMarkerRegistry = promptMarkerRegistry;
    const commandLineBuffer = new CommandLineBuffer(promptMarkerRegistry);
    const inputWriter = new TerminalInputWriter(
      this.pty,
      this.model,
      shellDefinition?.lineEditor,
      () => this.scrollToBottomOnUserInput(),
    );
    this.disposables.push(promptMarkerRegistry);

    this.clipboardHandler = new ClipboardHandler(
      this.clipboard,
      this.model,
      this.pty,
      this.configService,
      this.selectionHandler,
      shellDefinition?.lineEditor,
      commandLineBuffer,
      inputWriter,
    );
    this.disposables.push(this.renderer.register(this.clipboardHandler));
    this.inputHandler = new InputHandler(this.model, this.pty, () =>
      this.scrollToBottomOnUserInput(),
    );
    this.disposables.push(this.renderer.register(this.inputHandler));

    if (shellProfile.enable_shell_integration) {
      this.disposables.push(
        this.renderer.register(
          new CommandLineObserver(
            this.model,
            this.configService.getPromptSegments(),
            this.contextMenuOverlay,
            this.clipboard,
            promptMarkerRegistry,
            commandLineBuffer,
          ),
        ),
      );
      this.editor = new CommandLineEditor(
        this.clipboard,
        this.pty,
        this.model,
        shellDefinition?.lineEditor,
        commandLineBuffer,
        inputWriter,
      );
      this.disposables.push(this.renderer.register(this.editor));
    }
  }

  /** Tries the shell again after a failed start. */
  retry(): void {
    if (this.runtime.status !== "failed" || !this.ptyHandler) return;
    this.setRuntime({ status: "starting" });
    this.ptyHandler.restart();
  }

  /** Ends the session for good: the workbench decided so. Idempotent. */
  close(): void {
    const status = this.runtime.status;
    if (status === "closed" || status === "closing") return;
    this.setRuntime({ status: "closing" });
    this.detach();
    this.model.dispose();
    this.hostFacts.complete();
    this.renderer.dispose();
    this.pty.dispose();
    this.disposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.subscription.unsubscribe();
    this.setRuntime({ status: "closed" });
    this.runtime$$.complete();
    this.display$$.complete();
  }

  // ---- axis B: display -----------------------------------------------------

  /**
   * Puts the terminal on screen inside `parent`. The first time it opens the
   * machine and hooks up what needs a DOM; afterwards it only moves the
   * element. Sizing happens here, never while detached (the spike in step 13:
   * a detached resize reflows nothing the cursor sits on).
   */
  attach(parent: HTMLElement): void {
    if (!this._terminalId) {
      throw new Error("SessionHost must be initialized before attach");
    }
    if (!this.hostElement) {
      this.hostElement = this.openInto(document.createElement("div"));
    }
    if (this.hostElement.parentElement !== parent) {
      parent.appendChild(this.hostElement);
    }
    this.display$$.next("attached");
    this.renderer.setVisible(true);
    this.resizeHandler?.resize();
    this.scheduleRestoreIfPending();
  }

  /** Takes the terminal off screen; the shell and the model carry on. */
  detach(): void {
    if (this.display === "detached") return;
    this.hostElement?.remove();
    this.renderer.setVisible(false);
    this.display$$.next("detached");
  }

  private openInto(element: HTMLDivElement): HTMLDivElement {
    element.classList.add("session-host");
    element.style.width = "100%";
    element.style.height = "100%";
    this.renderer.open(element, this.configService.config.font?.enable_ligatures ?? false);
    this.resizeHandler = new ResizeHandler(this.pty, element, this.machine);
    this.disposables.push(this.renderer.register(this.resizeHandler));
    this.disposables.push(this.renderer.register(new MouseHandler(element, this.machine)));
    this.disposables.push(
      this.renderer.register(
        new TerminalPaddingHandler(this.model, this.configService, element, this.renderer),
      ),
    );
    return element;
  }

  // ---- focus and view --------------------------------------------------

  focus(): void {
    if (this.display !== "attached") return;
    this.focusHandler?.focus();
  }

  blur(): void {
    this.focusHandler?.blur();
  }

  setVisible(visible: boolean): void {
    this.renderer.setVisible(visible);
  }

  setPaneMaximized(maximized: boolean): void {
    this.model.setPaneMaximized(maximized);
  }

  scrollToBottom(): void {
    this.renderer.terminal.scrollToBottom();
  }

  // ---- input -----------------------------------------------------------

  clearBuffer(): void {
    this.inputHandler?.clearBuffer();
  }

  /** Writes text as if typed; with `autoExecute` an Enter follows. */
  writeRaw(text: string, autoExecute?: boolean): void {
    this.inputHandler?.writeRaw(text, autoExecute);
  }

  /** Types dropped or picked paths, rendered for this session's shell. */
  insertPaths(paths: readonly string[]): void {
    const renderedPaths = paths
      .map((path) => this.model.renderPathForInsertion(path))
      .filter((path): path is string => Boolean(path));
    if (renderedPaths.length === 0) return;
    this.writeRaw(renderedPaths.join(" "));
  }

  paste(): Promise<void> {
    return this.clipboardHandler?.paste() ?? Promise.resolve();
  }

  copy(): Promise<void> {
    return this.clipboardHandler?.copy() ?? Promise.resolve();
  }

  cut(): void {
    this.editor?.cut();
  }

  runEditorAction(actionId: ShellLineEditorActionContract): void {
    this.editor?.runEditorAction(actionId);
  }

  replaceInput(inputText: string, cursorIndex: number, autoExecute?: boolean): void {
    this.editor?.replaceInput(inputText, cursorIndex, autoExecute);
  }

  search(request: TerminalSearchRequestContract): void {
    this.searchHandler?.search(request);
  }

  reveal(request: TerminalSearchRevealRequestContract): void {
    this.searchHandler?.reveal(request);
  }

  // ---- reading the buffer ---------------------------------------------

  /**
   * A restorable snapshot of the buffer: the scrollback serialized to text with
   * SGR colours and the concealed `^^#` marker lines, plus per-command metadata,
   * so a restored session looks and behaves like it did at close (step 27).
   * `maxLines <= 0` captures nothing.
   */
  snapshot(maxLines: number): SessionSnapshot {
    if (maxLines <= 0) {
      return { version: SESSION_SNAPSHOT_VERSION, scrollback: null, commands: [] };
    }
    const scrollback = this.captureScrollback(maxLines);
    return {
      version: SESSION_SNAPSHOT_VERSION,
      scrollback,
      commands: scrollback ? this.captureCommands() : [],
    };
  }

  /**
   * The recent buffer serialized with colours and attributes (incl. the conceal
   * that hides `^^#` marker lines). Restored marker ids are shifted into a range
   * the live session's ids never reach, so restored markers can't collide with
   * new ones - bash/zsh restart their counter at 1 (step 27).
   */
  private captureScrollback(maxLines: number): string | null {
    const terminal = this.renderer?.terminal;
    if (!terminal) {
      return null;
    }
    const buffer = terminal.buffer.active;
    const beginLineIndex = Math.max(0, buffer.length - maxLines);
    const serialized = serializeScrollback(buffer, beginLineIndex, buffer.length);
    if (serialized === "") {
      return null;
    }
    return serialized.replace(
      MARKER_ID_PATTERN,
      (_match, digits: string) => `^^#${offsetMarkerId(digits)}`,
    );
  }

  /**
   * The reported metadata of every command, with marker ids shifted to match.
   * The shell integration's own bootstrap dot-source is dropped: the user did not
   * run it, and without metadata its (concealed) restored marker renders nothing
   * (step 27).
   */
  private captureCommands(): CommandSnapshot[] {
    return this.model.commands
      .filter((command) => !command.isIntegrationBootstrap)
      .map((command) => ({
        id: offsetMarkerId(command.id),
        directory: command.directory ?? "",
        machine: command.machine ?? "",
        user: command.user ?? "",
        data: command.rawData,
      }));
  }

  /**
   * Replay a snapshot's scrollback into the buffer, above a separator line, then
   * re-anchor its markers and seed their command metadata so the decorations
   * render. The replay is dead scrollback - the live prompt runs below it - so
   * the model must not read it as input: `beginRestore` gates the observer's
   * input mirror until the writes are parsed. A snapshot of a different version
   * or without scrollback is ignored.
   */
  restore(snapshot: SessionSnapshot): void {
    if (snapshot.version !== SESSION_SNAPSHOT_VERSION || !snapshot.scrollback) {
      return;
    }
    // Stash it; the replay waits for the first attach, when the terminal is open
    // and at its final size. Called before start() so start() defers the pty.
    this._pendingRestore = snapshot;
  }

  private scheduleRestoreIfPending(): void {
    if (!this._pendingRestore || this._restoreScheduled) {
      return;
    }
    this._restoreScheduled = true;
    // A frame after the first attach the container has laid out, so the fit
    // yields the real row count the fill and the pty spawn depend on.
    requestAnimationFrame(() => this.completeRestore());
  }

  /**
   * Replay the stashed snapshot into the now-open, final-sized terminal, then
   * spawn the shell. On Windows the restored scrollback is pushed above the
   * viewport with a screenful of blank lines first, so ConPTY - which repaints
   * its whole screen on start - paints into the fresh area below it, not over
   * it. The observer must not read the replay as input: `beginRestore` gates it
   * until the writes are parsed (step 27).
   */
  private completeRestore(): void {
    const snapshot = this._pendingRestore;
    this._pendingRestore = undefined;
    const terminal = this.renderer?.terminal;
    if (!snapshot?.scrollback || !terminal) {
      this.startDeferredPty();
      return;
    }
    // Fit the terminal (not the pty - it isn't spawned yet) so the fill and the
    // pty's spawn size use the real row count.
    this.resizeHandler?.fitTerminalWithoutPty();

    this.model.beginRestore();
    terminal.write(snapshot.scrollback);
    terminal.write("\r\n\x1b[2m---- restored session ----\x1b[0m");
    const trailer = this.os.platform() === "windows" ? "\r\n".repeat(terminal.rows) : "\r\n";
    terminal.write(trailer, () => {
      this.model.updateCommands(
        snapshot.commands.map((command) => {
          const restored = new Command(
            command.id,
            command.directory,
            command.machine,
            command.user,
          );
          restored.setData(command.data);
          return restored;
        }),
      );
      this.promptMarkerRegistry?.anchorRestoredMarkers();
      this.model.endRestore();
      this.startDeferredPty();
    });
  }

  /** Register the pty handler that `start()` held back for a restored session. */
  private startDeferredPty(): void {
    if (!this.ptyHandler || this.runtime.status === "closing" || this.runtime.status === "closed") {
      return;
    }
    this.disposables.push(this.renderer.register(this.ptyHandler));
  }

  getRecentOutputSnapshot(maxLines = 60, maxChars = 4000): string {
    const terminal = this.renderer?.terminal;
    if (!terminal) {
      return "";
    }

    const lineTexts: string[] = [];
    const beginLineIndex = Math.max(0, terminal.buffer.active.length - maxLines);
    for (
      let currentLineIndex = beginLineIndex;
      currentLineIndex < terminal.buffer.active.length;
      currentLineIndex++
    ) {
      const line = terminal.buffer.active.getLine(currentLineIndex);
      if (!line) {
        continue;
      }

      const lineText = line.translateToString(false);
      if (lineText.startsWith("^^#")) {
        continue;
      }
      lineTexts.push(lineText);
    }

    const snapshot = lineTexts.join("\n").trim();
    if (snapshot.length <= maxChars) {
      return snapshot;
    }

    return snapshot.slice(snapshot.length - maxChars);
  }

  /**
   * The session's process tree, queried fresh on every call - it is a live
   * view of what the shell is running now, never cached or reported as a fact.
   */
  getProcessTree(): Promise<ProcessTreeSnapshot> {
    const terminalId = this.terminalId;
    if (!terminalId) {
      return Promise.reject(new Error("Session has no terminal id yet."));
    }
    return TauriPty.getProcessTreeByTerminalId(terminalId);
  }

  getLatestCommandOutputSnapshot(maxChars = 3000): string {
    const latestCommand = this.model.commands.at(-1);
    if (!latestCommand) {
      return "";
    }

    const outputText =
      this.commandBlockResolver.resolveByCommandId(latestCommand.id)?.outputText ?? "";
    if (outputText.length <= maxChars) {
      return outputText;
    }

    return outputText.slice(outputText.length - maxChars);
  }

  /** The marker menu for the first command scrolled out of view; empty when there is none. */
  buildCommandOutOfViewMenu(): ContextMenuItem[] {
    const commandOutOfView = this.model.commands.find(
      (command) => command.isFirstCommandOutOfViewport,
    );
    if (!commandOutOfView?.command) {
      return [];
    }
    const block = () => this.commandBlockResolver.resolveByCommandId(commandOutOfView.id);

    return buildCommandMenuItems({
      clipboard: this.clipboard,
      commandText: commandOutOfView.command,
      getCommandOutput: () => block()?.outputText ?? "",
      getBlockRange: () => block()?.blockRange ?? EMPTY_BLOCK_RANGE,
      scrollToCommandTop: () => {
        const details = block();
        if (details) this.renderer.terminal.scrollToLine(details.markerLineIndex);
      },
      scrollToCommandBottom: () => {
        const details = block();
        if (!details) return;
        this.renderer.terminal.scrollToLine(
          Math.max(details.markerLineIndex, details.nextMarkerLineIndex - 1),
        );
      },
      onFilterBlock: (range) => this.model.report({ type: "filterBlockRequested", range }),
    });
  }

  // ---- internals -------------------------------------------------------

  private setRuntime(runtime: SessionRuntime): void {
    if (this.runtime$$.closed) return;
    this.runtime$$.next(runtime);
  }

  private onStartFailed(error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.setRuntime({ status: "failed", reason });
    this.hostFacts.next({ type: "startFailed", reason });
    ErrorReporter.reportException({
      error,
      handled: true,
      source: "SessionHost",
      context: { operation: "start", terminalId: this._terminalId },
    });
  }

  private onFocusChanged(focused: boolean): void {
    this.machine.setFocus(focused);
    if (focused) {
      this.model.clearUnreadNotification();
    }
    this.hostFacts.next({ type: "focusChanged", focused });
  }

  private resizeSoon(): void {
    if (this.display !== "attached") return;
    setTimeout(() => this.resizeHandler?.resize(), RESIZE_AFTER_LAYOUT_CHANGE_MS);
  }

  /**
   * Scrolls back to the prompt when the user types while scrolled up. xterm
   * does this on its own for keys it handles (`scrollOnUserInput`); this is
   * the equivalent for input paths that bypass xterm's key handling, such as
   * autocomplete inserts, composer submits and line-editor actions.
   */
  private scrollToBottomOnUserInput(): void {
    if (this.configService.config.scrollbar?.scroll_on_user_input ?? true) {
      this.renderer.terminal.scrollToBottom();
    }
  }

  private isUnreadBadgeEnabled(): boolean {
    try {
      return this.configService.config.terminal?.notifications?.unread_badge ?? true;
    } catch {
      return true;
    }
  }
}

const EMPTY_BLOCK_RANGE: CommandMenuBlockRange = { beginBufferLine: 1, endBufferLine: 0 };

function createSessionToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
