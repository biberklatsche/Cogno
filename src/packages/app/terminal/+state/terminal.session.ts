import { Injectable } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { CommandBlockResolver } from "@cogno/core/session/decoration/command-block-resolver";
import {
  buildCommandMenuItems,
  CommandMenuBlockRange,
} from "@cogno/core/session/decoration/command-menu-items";
import { PromptMarkerRegistry } from "@cogno/core/session/decoration/prompt-marker.registry";
import { toTerminalMachineOptions } from "@cogno/core/session/host/terminal-machine-options.mapper";
import { CommandLineBuffer } from "@cogno/core/session/model/command-line.buffer";
import { CommandLineObserver } from "@cogno/core/session/model/command-line.observer";
import { CursorHandler } from "@cogno/core/terminal/handlers/cursor.handler";
import { FocusHandler } from "@cogno/core/terminal/handlers/focus.handler";
import { MouseHandler } from "@cogno/core/terminal/handlers/mouse.handler";
import { PtyHandler } from "@cogno/core/terminal/handlers/pty.handler";
import { ResizeHandler } from "@cogno/core/terminal/handlers/resize.handler";
import { ScrollStateHandler } from "@cogno/core/terminal/handlers/scroll-state.handler";
import { SelectionHandler } from "@cogno/core/terminal/handlers/selection.handler";
import { IPty, Pty } from "@cogno/core/terminal/pty";
import { IRenderer, Renderer } from "@cogno/core/terminal/renderer";
import { NotificationChannelsPort } from "@cogno/features/coding-agent/ports";
import { Opener, OsPlatform, PtyTransport } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { ShellDefinitionContract } from "@cogno/shared/contributions";
import {
  buildNotificationPreferencesMenuItems,
  ChannelDefinitionContract,
  NotificationDefinitionContract,
  NotificationPreferencesState,
  NotificationPreferencesUseCase,
} from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";
import { IDisposable } from "@cogno/shared/support";
import {
  ContextMenuItem,
  ContextMenuOverlayService,
  DialogRef,
  DialogService,
} from "@cogno/shared/ui";
import { Observable, Subscription } from "rxjs";
import { ActionFired, ActionName } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { TerminalAutocompleteFeatureSuggestorService } from "../../app-host/terminal-autocomplete-feature-suggestor.service";
import { TerminalActivityService } from "../../common/terminal-activity/terminal-activity.service";
import {
  PaneMaximizedChangedEvent,
  VisibleTerminalsChangedEvent,
} from "../../grid-list/+bus/events";
import { KeybindService } from "../../keybinding/keybind.service";
import { formatKeybinding } from "../../keybinding/pipe/keybinding.pipe";
import { NotificationTargetResolverService } from "../../notification/+state/notification-target-resolver.service";
import {
  TerminalSystemInfoDialogComponent,
  TerminalSystemInfoDialogData,
  TerminalSystemInfoSource,
} from "../system-info/terminal-system-info-dialog.component";
import { CommandLineEditor } from "./advanced/ui/command-line.editor";
import { ClipboardHandler } from "./handler/clipboard.handler";
import {
  CompletedCommandNotificationHandler,
  DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS,
  LONG_RUNNING_COMMAND_NOTIFICATION_ID,
} from "./handler/completed-command-notification.handler";
import { FullScreenAppHandler } from "./handler/full-screen-app.handler";
import { InputHandler } from "./handler/input.handler";
import { LinkHandler } from "./handler/link.handler";
import { ResumeLinkHandler } from "./handler/resume-link.handler";
import { TerminalFocusCoordinator } from "./handler/terminal-focus.coordinator";
import {
  OSC9_NOTIFICATION_ID,
  TerminalNotificationHandler,
} from "./handler/terminal-notification.handler";
import { TerminalPaddingHandler } from "./handler/terminal-padding.handler";
import { TerminalSearchHandler } from "./handler/terminal-search.handler";
import { TerminalTitleHandler } from "./handler/terminal-title.handler";
import { TerminalInputWriter } from "./input-writer";
import { KeybindExecutor } from "./keybind/keybind.executor";
import { TerminalStateManager } from "./state";
import { TerminalSessionRegistry } from "./terminal-session.registry";

@Injectable()
export class TerminalSession {
  private renderer: IRenderer;
  private readonly pty: IPty;

  private focusCoordinator?: TerminalFocusCoordinator = undefined;

  private subscription: Subscription = new Subscription();
  private readonly disposables: IDisposable[];
  private disposed: boolean = false;
  private processInfoDialogReference?: DialogRef<void>;
  private notificationPreferencesState?: NotificationPreferencesState;
  private readonly completedCommandNotificationHandler: CompletedCommandNotificationHandler;
  private readonly commandBlockResolver: CommandBlockResolver;

  private terminalId?: TerminalId;
  private shellProfile?: ShellProfile;

  constructor(
    private readonly os: OsPlatform,
    private readonly environment: Environment,
    private readonly clipboard: ClipboardAccess,
    private configService: ConfigService,
    private bus: AppBus,
    private stateManager: TerminalStateManager,
    private terminalAutocompleteFeatureSuggestorService: TerminalAutocompleteFeatureSuggestorService,
    private dialog: DialogService,
    private wiringService: AppWiringService,
    private contextMenuOverlayService: ContextMenuOverlayService,
    private notificationTargetResolverService: NotificationTargetResolverService,
    private readonly opener: Opener,
    private readonly terminalActivity: TerminalActivityService,
    private readonly notificationChannelsPort: NotificationChannelsPort,
    private readonly keybindService: KeybindService,
    ptyTransport: PtyTransport,
    private terminalSessionRegistry: TerminalSessionRegistry = new TerminalSessionRegistry(),
  ) {
    this.pty = new Pty(ptyTransport, this.environment.isDevMode());
    this.renderer = new Renderer(
      toTerminalMachineOptions(this.configService.config),
      this.os.platform(),
    );
    this.disposables = [this.renderer, this.pty];
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
    this.completedCommandNotificationHandler = new CompletedCommandNotificationHandler(
      this.configService,
      this.bus,
      () => this.terminalId,
      () => this.getNotificationPreferencesState(),
      () => this.resolveNotificationTarget(),
    );
    this.commandBlockResolver = new CommandBlockResolver(() => this.renderer.terminal);
  }

  initialize(terminalId: TerminalId, shellProfile: ShellProfile): void {
    this.terminalId = terminalId;
    this.shellProfile = shellProfile;
    this.terminalSessionRegistry.register(terminalId, shellProfile, this, this.stateManager);
    if (!shellProfile.shell_type) {
      throw new Error("Shell profile must define a shell type.");
    }
    this.stateManager.initialize(terminalId, shellProfile.shell_type, shellProfile);
    // The session states facts; turning them into the old bus messages is
    // this host's job until the workbench listens to facts itself.
    this.subscription.add(
      this.stateManager.model.facts$.subscribe((fact) => {
        switch (fact.type) {
          case "promptReported":
            this.bus.publish({
              path: ["app", "terminal", terminalId],
              type: "TerminalCursorRestoreRequested",
            });
            break;
          case "commandCompleted":
            this.completedCommandNotificationHandler.handleCompletedCommand(fact.command);
            break;
          case "filterBlockRequested":
            this.requestBlockFilter(fact.range);
            break;
        }
      }),
    );
    this.subscription.add(
      this.bus.onType$("PaneMaximizedChanged").subscribe((event: PaneMaximizedChangedEvent) => {
        this.stateManager.setPaneMaximized(event.payload?.terminalId === this.terminalId);
      }),
    );
    this.subscription.add(
      this.bus
        .onType$("VisibleTerminalsChanged")
        .subscribe((event: VisibleTerminalsChangedEvent) => {
          this.renderer.setVisible(event.payload?.terminalIds.includes(terminalId) ?? true);
        }),
    );
  }

  initializeTerminal(terminalContainer: HTMLDivElement): void {
    if (!this.terminalId || !this.shellProfile) {
      throw new Error("TerminalSession must be initialized before initializeTerminal");
    }
    this.renderer.open(
      terminalContainer,
      this.configService.config.font?.enable_ligatures ?? false,
    );
    // The machine takes values; reading the config and pushing them again
    // when it changes is the host's job (ARCHITECTURE.md 2.1).
    const terminalId = this.terminalId;
    this.subscription.add(
      this.configService.config$.subscribe((config) => {
        this.renderer.setOptions(toTerminalMachineOptions(config));
        this.bus.publish({
          path: ["app", "terminal", terminalId],
          type: "TerminalThemeChanged",
        });
      }),
    );
    const focusHandler = new FocusHandler((focused) =>
      this.focusCoordinator?.onFocusChanged(focused),
    );
    this.focusCoordinator = new TerminalFocusCoordinator(
      terminalId,
      this.bus,
      this.stateManager,
      focusHandler,
    );
    this.disposables.push(this.focusCoordinator);
    const resizeHandler = new ResizeHandler(this.pty, terminalContainer, this.stateManager);
    this.disposables.push(this.renderer.register(resizeHandler));
    // Padding and theme changes alter the usable area. The machine offers
    // `resize()`; deciding when it is needed is session knowledge.
    this.subscription.add(
      this.bus.on$({ path: ["app", "terminal", this.terminalId] }).subscribe((event) => {
        if (
          event.type === "TerminalThemeChanged" ||
          event.type === "TerminalThemePaddingAdded" ||
          event.type === "TerminalThemePaddingRemoved"
        ) {
          setTimeout(() => resizeHandler.resize(), 100);
        }
      }),
    );
    this.disposables.push(
      this.renderer.register(
        new PtyHandler(this.terminalId, this.pty, this.shellProfile, {
          // The machine reports; publishing these is the session's job, and
          // deciding what to do with them is the workbench's (step 20).
          onStarted: (shellType: string) =>
            this.bus.publish({
              path: ["app", "terminal", terminalId],
              type: "PtyInitialized",
              payload: { terminalId, shellType: shellType as ShellType },
            }),
          onExited: () =>
            this.bus.publish({
              path: ["app", "terminal"],
              type: "RemovePane",
              payload: terminalId,
            }),
          onOutput: () => this.terminalActivity?.emit(terminalId),
        }),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new TerminalPaddingHandler(
          this.terminalId,
          this.configService,
          this.bus,
          terminalContainer,
          this.renderer,
        ),
      ),
    );
    this.disposables.push(
      this.renderer.register(new TerminalTitleHandler(this.terminalId, this.bus)),
    );
    this.disposables.push(
      this.renderer.register(
        new TerminalNotificationHandler(
          this.bus,
          this.stateManager,
          () => this.getNotificationPreferencesState(),
          () => this.resolveNotificationTarget(),
        ),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new FullScreenAppHandler(this.terminalId, this.bus, this.stateManager),
      ),
    );
    this.disposables.push(this.renderer.register(focusHandler));
    const selectionHandler = new SelectionHandler(this.stateManager);
    this.disposables.push(this.renderer.register(selectionHandler));
    this.disposables.push(
      this.renderer.register(
        new TerminalSearchHandler(this.bus, this.terminalId, this.configService),
      ),
    );
    this.disposables.push(
      this.renderer.register(new MouseHandler(terminalContainer, this.stateManager)),
    );
    this.disposables.push(this.renderer.register(new CursorHandler(this.stateManager)));
    this.disposables.push(this.renderer.register(new ScrollStateHandler(this.stateManager)));
    this.disposables.push(
      this.renderer.register(
        new LinkHandler(this.clipboard, this.stateManager, this.opener, this.os),
      ),
    );
    this.disposables.push(
      this.renderer.register(new ResumeLinkHandler(this.clipboard, this.pty, this.os)),
    );
    this.disposables.push(new KeybindExecutor(this.bus, this.stateManager));

    const shellDefinition = this.shellProfile.enable_shell_integration
      ? this.wiringService
          .getShellDefinitions()
          .find(
            (definition: ShellDefinitionContract) =>
              definition.support.shellType === this.shellProfile?.shell_type,
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
      this.stateManager,
      shellDefinition?.lineEditor,
      () => this.scrollToBottomOnUserInput(),
    );
    this.disposables.push(promptMarkerRegistry);

    this.disposables.push(
      this.renderer.register(
        new ClipboardHandler(
          this.clipboard,
          this.bus,
          this.terminalId,
          this.stateManager,
          this.pty,
          this.configService,
          selectionHandler,
          shellDefinition?.lineEditor,
          commandLineBuffer,
          inputWriter,
        ),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new InputHandler(this.bus, this.terminalId, this.stateManager, this.pty, () =>
          this.scrollToBottomOnUserInput(),
        ),
      ),
    );

    if (this.shellProfile.enable_shell_integration) {
      this.terminalAutocompleteFeatureSuggestorService.preloadForShellIntegration(
        this.shellProfile.shell_type,
      );
      this.disposables.push(
        this.renderer.register(
          new CommandLineObserver(
            this.stateManager.model,
            this.configService.getPromptSegments(),
            this.contextMenuOverlayService,
            this.clipboard,
            promptMarkerRegistry,
            commandLineBuffer,
          ),
        ),
      );
      this.disposables.push(
        this.renderer.register(
          new CommandLineEditor(
            this.clipboard,
            this.bus,
            this.pty,
            this.stateManager,
            shellDefinition?.lineEditor,
            commandLineBuffer,
            inputWriter,
          ),
        ),
      );
    }
  }

  buildContextMenu(): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
      {
        label: "Paste",
        action: async () => {
          this.focusCoordinator?.focus();
          this.bus.publish({ path: ["app", "terminal"], type: "Paste", payload: this.terminalId });
        },
        keybinding: this.keybindingFor("paste"),
      },
      { separator: true },
      {
        label: "Split Right",
        action: () => {
          this.bus.publish({
            path: ["app", "terminal"],
            type: "SplitPaneRight",
            payload: this.terminalId,
          });
        },
        keybinding: this.keybindingFor("split_right"),
      },
      {
        label: "Split Left",
        action: () => {
          this.bus.publish({
            path: ["app", "terminal"],
            type: "SplitPaneLeft",
            payload: this.terminalId,
          });
        },
        keybinding: this.keybindingFor("split_left"),
      },
      {
        label: "Split Down",
        action: () => {
          this.bus.publish({
            path: ["app", "terminal"],
            type: "SplitPaneDown",
            payload: this.terminalId,
          });
        },
        keybinding: this.keybindingFor("split_down"),
      },
      {
        label: "Split Up",
        action: () => {
          this.bus.publish({
            path: ["app", "terminal"],
            type: "SplitPaneUp",
            payload: this.terminalId,
          });
        },
        keybinding: this.keybindingFor("split_up"),
      },
      { separator: true },
      this.stateManager.isPaneMaximized
        ? {
            label: "Minimize",
            action: () => {
              this.bus.publish({
                path: ["app", "terminal"],
                type: "MinimizePane",
                payload: this.terminalId,
              });
            },
            keybinding: this.keybindingFor("minimize_pane"),
          }
        : {
            label: "Maximize",
            action: () => {
              this.bus.publish({
                path: ["app", "terminal"],
                type: "MaximizePane",
                payload: this.terminalId,
              });
            },
            keybinding: this.keybindingFor("maximize_pane"),
          },
      { separator: true },
      {
        label: "Clear",
        action: () => {
          this.focusCoordinator?.focus();
          this.bus.publish({
            path: ["app", "terminal"],
            type: "ClearBuffer",
            payload: this.terminalId,
          });
        },
        keybinding: this.keybindingFor("clear_buffer"),
      },
      {
        label: "Close",
        action: () => {
          this.bus.publish({
            path: ["app", "terminal"],
            type: "RemovePane",
            payload: this.terminalId,
          });
        },
        keybinding: this.keybindingFor("close_terminal"),
      },
      { separator: true },
      {
        label: "Process Info",
        action: () => this.openProcessInfoDialog(),
      },
    ];

    if (this.stateManager.hasSelection) {
      items.unshift({
        label: "Copy",
        action: () => {
          this.focusCoordinator?.focus();
          this.bus.publish({ path: ["app", "action"], type: "ActionFired", payload: "copy" });
        },
        keybinding: this.keybindingFor("copy"),
      });
    }
    return items;
  }

  private keybindingFor(actionName: ActionName): string {
    return formatKeybinding(this.keybindService.getKeybinding(actionName), this.os.platform());
  }

  buildHeaderMenu(): ContextMenuItem[] {
    return this.buildNotificationContextMenuItems();
  }

  buildHeaderCommandMenu(): ContextMenuItem[] {
    return this.buildHeaderCommandMenuItems();
  }

  dispose() {
    if (this.disposed) return;
    this.processInfoDialogReference?.close();
    this.processInfoDialogReference = undefined;
    this.terminalSessionRegistry.unregister(this.terminalId);
    this.bus.publish({
      type: "TerminalRemoved",
      path: ["app", "terminal"],
      payload: this.terminalId,
    });
    this.disposed = true;
    this.renderer.dispose();
    this.pty.dispose();
    this.disposables.forEach((disposable) => {
      disposable.dispose();
    });
    this.subscription.unsubscribe();
  }

  focus(): void {
    this.focusCoordinator?.focus();
  }

  scrollToBottom(): void {
    this.renderer.terminal.scrollToBottom();
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
    const latestCommand = this.stateManager.commands.at(-1);
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

  get isWebglContextLost$(): Observable<boolean> {
    return this.renderer.isWebglContextLost$;
  }

  insertPaths(paths: readonly string[]): void {
    if (!this.terminalId) {
      return;
    }

    const renderedPaths = paths
      .map((path) => this.renderInsertablePath(path))
      .filter((path): path is string => Boolean(path));

    if (renderedPaths.length === 0) {
      return;
    }

    this.bus.publish({
      path: ["app", "terminal"],
      type: "WriteRawToPty",
      payload: {
        terminalId: this.terminalId,
        text: renderedPaths.join(" "),
      },
    });
  }

  private openProcessInfoDialog(): void {
    if (!this.terminalId) {
      return;
    }

    this.processInfoDialogReference?.close();
    this.processInfoDialogReference = this.dialog.open<TerminalSystemInfoDialogData, void>(
      TerminalSystemInfoDialogComponent,
      {
        title: "Terminal System Info",
        maxWidth: "100vw",
        hasBackdrop: false,
        movable: true,
        resizable: true,
        showCloseButton: true,
        position: { right: "16px", bottom: "16px" },
        data: {
          terminalId: this.terminalId,
          systemInfo: this.getSystemInfoSource(),
        },
      },
    );
  }

  private getSystemInfoSource(): TerminalSystemInfoSource {
    return {
      state$: this.stateManager.state$,
      commands$: this.stateManager.commands$,
    };
  }

  private renderInsertablePath(path: string): string | undefined {
    return this.stateManager.renderPathForInsertion(path);
  }

  private buildNotificationContextMenuItems(): ContextMenuItem[] {
    const availableNotificationChannels = this.notificationChannelsPort.getAvailableChannels();
    const notificationPreferencesState = this.getNotificationPreferencesState(
      availableNotificationChannels,
    );

    return buildNotificationPreferencesMenuItems({
      notificationDefinitions: this.getNotificationDefinitions(),
      notificationsLabel: "Notify me when…",
      channels: availableNotificationChannels,
      state: notificationPreferencesState,
      hideWhenNoChannels: true,
      onToggleNotification: (notificationId) => this.toggleNotification(notificationId),
      onToggleChannel: (notificationChannelId) =>
        this.toggleNotificationChannel(notificationChannelId),
    });
  }

  private getNotificationPreferencesState(
    channelDefinitions: ReadonlyArray<ChannelDefinitionContract> = this.getChannelDefinitions(),
  ): NotificationPreferencesState {
    if (!this.notificationPreferencesState) {
      this.notificationPreferencesState = NotificationPreferencesUseCase.createInitialState(
        this.getNotificationDefinitions(),
        channelDefinitions,
      );
    }
    return this.notificationPreferencesState;
  }

  private toggleNotification(notificationId: string): NotificationPreferencesState {
    const notificationPreferencesState = NotificationPreferencesUseCase.toggleNotification(
      this.getNotificationPreferencesState(),
      notificationId,
    );
    this.notificationPreferencesState = notificationPreferencesState;
    return notificationPreferencesState;
  }

  private toggleNotificationChannel(notificationChannelId: string): NotificationPreferencesState {
    const isAvailable = this.notificationChannelsPort
      .getAvailableChannels()
      .some((channel) => channel.id === notificationChannelId);
    if (!isAvailable) {
      return this.getNotificationPreferencesState();
    }

    const notificationPreferencesState = NotificationPreferencesUseCase.toggleChannel(
      this.getNotificationPreferencesState(),
      notificationChannelId,
    );
    this.notificationPreferencesState = notificationPreferencesState;
    return notificationPreferencesState;
  }

  private getNotificationDefinitions(): NotificationDefinitionContract[] {
    const notificationsConfig = this.configService.config.terminal?.notifications;
    const minimumDurationSeconds =
      notificationsConfig?.long_running_command?.minimum_duration_seconds ??
      DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS;
    return [
      {
        id: OSC9_NOTIFICATION_ID,
        label: "App notifications (OSC 9)",
        defaultEnabled: notificationsConfig?.osc9?.enabled ?? true,
      },
      {
        id: LONG_RUNNING_COMMAND_NOTIFICATION_ID,
        label: `Command finished (ran ≥ ${minimumDurationSeconds} s)`,
        defaultEnabled: notificationsConfig?.long_running_command?.enabled ?? true,
      },
    ];
  }

  private getChannelDefinitions(): ChannelDefinitionContract[] {
    return [...this.notificationChannelsPort.getAvailableChannels()];
  }

  private buildHeaderCommandMenuItems(): ContextMenuItem[] {
    const commandOutOfView = this.stateManager.commands.find(
      (command) => command.isFirstCommandOutOfViewport,
    );
    if (!commandOutOfView?.command) {
      return [];
    }

    return buildCommandMenuItems({
      clipboard: this.clipboard,
      commandText: commandOutOfView.command,
      getCommandOutput: () =>
        this.commandBlockResolver.resolveByCommandId(commandOutOfView.id)?.outputText ?? "",
      getBlockRange: () =>
        this.commandBlockResolver.resolveByCommandId(commandOutOfView.id)?.blockRange ??
        this.createEmptyBlockRange(),
      scrollToCommandTop: () => {
        const commandBlockDetails = this.commandBlockResolver.resolveByCommandId(
          commandOutOfView.id,
        );
        if (!commandBlockDetails) {
          return;
        }

        this.renderer.terminal.scrollToLine(commandBlockDetails.markerLineIndex);
      },
      scrollToCommandBottom: () => {
        const commandBlockDetails = this.commandBlockResolver.resolveByCommandId(
          commandOutOfView.id,
        );
        if (!commandBlockDetails) {
          return;
        }

        this.renderer.terminal.scrollToLine(
          Math.max(
            commandBlockDetails.markerLineIndex,
            commandBlockDetails.nextMarkerLineIndex - 1,
          ),
        );
      },
      onFilterBlock: (range) => this.requestBlockFilter(range),
    });
  }

  private requestBlockFilter(range: CommandMenuBlockRange): void {
    this.bus.publish(ActionFired.create("open_terminal_search"));
    this.bus.publish({
      path: ["app", "terminal"],
      type: "TerminalSearchPanelRequested",
      payload: {
        terminalId: this.terminalId,
        beginBufferLine: range.beginBufferLine,
        endBufferLine: range.endBufferLine,
      },
    });
  }

  private createEmptyBlockRange(): CommandMenuBlockRange {
    return {
      beginBufferLine: 1,
      endBufferLine: 0,
    };
  }

  private resolveNotificationTarget() {
    if (!this.terminalId) {
      return undefined;
    }

    return this.notificationTargetResolverService.resolveForTerminal(this.terminalId);
  }
}
