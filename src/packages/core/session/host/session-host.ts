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
import {
  ShellLineEditorActionContract,
  ShellSessionCapabilitiesContract,
} from "@cogno/shared/contributions";
import {
  TerminalSearchRequestContract,
  TerminalSearchRevealRequestContract,
} from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";
import { IDisposable } from "@cogno/shared/support";
import { ContextMenuItem, ContextMenuOverlayService } from "@cogno/shared/ui";
import { combineLatest, map, merge, Observable, Subject, Subscription } from "rxjs";
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
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import { CommandLineBuffer } from "../model/command-line.buffer";
import { CommandLineObserver } from "../model/command-line.observer";
import { SessionModel, SessionModelSnapshot, TerminalInput } from "../model/session-model";
import { CommandRecorder } from "../recorder/command-recorder";
import { SessionFact } from "../session-facts";
import { shellDefinitions } from "../shells/shell-definitions";
import { toTerminalMachineOptions } from "./terminal-machine-options.mapper";

/** Both halves of a session's state as one read-only view. */
export type SessionState = MachineStateSnapshot & SessionModelSnapshot;

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
 */
export class SessionHost {
  readonly machine = new MachineState();
  readonly model: SessionModel;

  private readonly renderer: IRenderer;
  private readonly pty: IPty;
  private readonly hostFacts = new Subject<SessionFact>();
  private readonly subscription = new Subscription();
  private readonly disposables: IDisposable[];
  private readonly commandBlockResolver: CommandBlockResolver;
  private disposed = false;

  private _terminalId?: TerminalId;
  private _shellProfile?: ShellProfile;
  private focusHandler?: FocusHandler;
  private selectionHandler?: SelectionHandler;
  private inputHandler?: InputHandler;
  private clipboardHandler?: ClipboardHandler;
  private searchHandler?: TerminalSearchHandler;
  private editor?: CommandLineEditor;

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
    this.disposables = [];
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

  // ---- lifecycle -------------------------------------------------------

  initialize(terminalId: TerminalId, shellProfile: ShellProfile): void {
    if (!shellProfile.shell_type) {
      throw new Error("Shell profile must define a shell type.");
    }
    this._terminalId = terminalId;
    this._shellProfile = shellProfile;
    this.model.initialize(terminalId, shellProfile.shell_type, shellProfile, this.os.platform());
  }

  initializeTerminal(terminalContainer: HTMLDivElement): void {
    const terminalId = this._terminalId;
    const shellProfile = this._shellProfile;
    if (!terminalId || !shellProfile) {
      throw new Error("SessionHost must be initialized before initializeTerminal");
    }
    this.renderer.open(
      terminalContainer,
      this.configService.config.font?.enable_ligatures ?? false,
    );

    const resizeHandler = new ResizeHandler(this.pty, terminalContainer, this.machine);
    this.disposables.push(this.renderer.register(resizeHandler));
    const resizeSoon = () =>
      setTimeout(() => resizeHandler.resize(), RESIZE_AFTER_LAYOUT_CHANGE_MS);

    // The machine takes values; reading the config and pushing them again
    // when it changes is the host's job (ARCHITECTURE.md 2.1). A theme
    // change alters the usable area, so the terminal is measured again.
    this.subscription.add(
      this.configService.config$.subscribe((config) => {
        this.renderer.setOptions(toTerminalMachineOptions(config));
        if (!this.isUnreadBadgeEnabled()) {
          this.model.clearUnreadNotification();
        }
        resizeSoon();
      }),
    );
    this.subscription.add(
      this.model.facts$.subscribe((fact) => {
        if (fact.type === "paddingChanged") resizeSoon();
      }),
    );

    this.focusHandler = new FocusHandler((focused) => this.onFocusChanged(focused));
    this.disposables.push(
      this.renderer.register(
        new PtyHandler(terminalId, this.pty, shellProfile, {
          onStarted: (shellType) => {
            this.hostFacts.next({ type: "started", shellType });
            setTimeout(() => this.focus(), FOCUS_AFTER_START_MS);
          },
          onExited: () => this.hostFacts.next({ type: "exited" }),
          onOutput: () => this.hostFacts.next({ type: "outputReceived" }),
        }),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new TerminalPaddingHandler(
          this.model,
          this.configService,
          terminalContainer,
          this.renderer,
        ),
      ),
    );
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
    this.disposables.push(
      this.renderer.register(new MouseHandler(terminalContainer, this.machine)),
    );
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.model.dispose();
    this.hostFacts.complete();
    this.renderer.dispose();
    this.pty.dispose();
    this.disposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.subscription.unsubscribe();
  }

  // ---- focus and view --------------------------------------------------

  focus(): void {
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

  private onFocusChanged(focused: boolean): void {
    this.machine.setFocus(focused);
    if (focused) {
      this.model.clearUnreadNotification();
    }
    this.hostFacts.next({ type: "focusChanged", focused });
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
