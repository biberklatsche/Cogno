import { Injectable } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import {
  NotificationChannelsPort,
  NotificationDefinitionContract,
  Opener,
  ShellDefinitionContract,
  TerminalId,
} from "@cogno/core-api";
import {
  buildNotificationPreferencesMenuItems,
  ChannelDefinitionContract,
  NotificationPreferencesState,
  NotificationPreferencesUseCase,
} from "@cogno/core-domain";
import { IDisposable } from "@cogno/core-support";
import {
  ContextMenuItem,
  ContextMenuOverlayService,
  DialogRef,
  DialogService,
} from "@cogno/core-ui";
import { Observable, Subscription } from "rxjs";
import { ActionName } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { TerminalAutocompleteFeatureSuggestorService } from "../../app-host/terminal-autocomplete-feature-suggestor.service";
import { TerminalActivityService } from "../../common/terminal-activity/terminal-activity.service";
import { ShellProfile } from "../../config/+models/shell-config";
import { ConfigService } from "../../config/+state/config.service";
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
import { CommandBlockResolver } from "./advanced/ui/command-block-resolver";
import { CommandLineEditor } from "./advanced/ui/command-line.editor";
import { CommandLineObserver } from "./advanced/ui/command-line.observer";
import { buildCommandMenuItems, CommandMenuBlockRange } from "./advanced/ui/command-menu-items";
import { ClipboardHandler } from "./handler/clipboard.handler";
import {
  CompletedCommandNotificationHandler,
  LONG_RUNNING_COMMAND_NOTIFICATION_ID,
} from "./handler/completed-command-notification.handler";
import { CursorHandler } from "./handler/cursor.handler";
import { FocusHandler } from "./handler/focus.handler";
import { FullScreenAppHandler } from "./handler/full-screen-app.handler";
import { InputHandler } from "./handler/input.handler";
import { LinkHandler } from "./handler/link.handler";
import { MouseHandler } from "./handler/mouse.handler";
import { PtyHandler } from "./handler/pty.handler";
import { ResizeHandler } from "./handler/resize.handler";
import { ResumeLinkHandler } from "./handler/resume-link.handler";
import { ScrollStateHandler } from "./handler/scroll-state.handler";
import { SelectionHandler } from "./handler/selection.handler";
import {
  OSC9_NOTIFICATION_ID,
  TerminalNotificationHandler,
} from "./handler/terminal-notification.handler";
import { TerminalSearchHandler } from "./handler/terminal-search.handler";
import { TerminalTitleHandler } from "./handler/terminal-title.handler";
import { ThemeHandler } from "./handler/theme.handler";
import { KeybindExecutor } from "./keybind/keybind.executor";
import { IPty, Pty } from "./pty/pty";
import { IRenderer, Renderer } from "./renderer/renderer";
import { TerminalStateManager } from "./state";
import { TerminalSessionRegistry } from "./terminal-session.registry";

@Injectable()
export class TerminalSession {
  private renderer: IRenderer;
  private pty: IPty = new Pty();

  private focusHandler?: FocusHandler = undefined;

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
    private terminalSessionRegistry: TerminalSessionRegistry = new TerminalSessionRegistry(),
  ) {
    this.renderer = new Renderer(this.configService.config);
    this.disposables = [this.renderer, this.pty];
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
    this.focusHandler = new FocusHandler(this.terminalId, this.bus, this.stateManager);
    this.disposables.push(
      this.renderer.register(
        new ResizeHandler(
          this.terminalId,
          this.pty,
          this.bus,
          terminalContainer,
          this.stateManager,
        ),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new PtyHandler(
          this.terminalId,
          this.pty,
          this.shellProfile,
          this.bus,
          this.terminalActivity,
        ),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new ThemeHandler(this.terminalId, this.configService, this.bus, terminalContainer),
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
    this.disposables.push(this.renderer.register(this.focusHandler));
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
    this.disposables.push(this.renderer.register(new LinkHandler(this.stateManager, this.opener)));
    this.disposables.push(this.renderer.register(new ResumeLinkHandler(this.pty)));
    this.disposables.push(new KeybindExecutor(this.bus, this.stateManager));

    const shellDefinition = this.shellProfile.enable_shell_integration
      ? this.wiringService
          .getShellDefinitions()
          .find(
            (definition: ShellDefinitionContract) =>
              definition.support.shellType === this.shellProfile?.shell_type,
          )
      : undefined;

    this.disposables.push(
      this.renderer.register(
        new ClipboardHandler(
          this.bus,
          this.terminalId,
          this.stateManager,
          this.pty,
          this.configService,
          selectionHandler,
          shellDefinition?.lineEditor,
        ),
      ),
    );
    this.disposables.push(
      this.renderer.register(
        new InputHandler(this.bus, this.terminalId, this.stateManager, this.pty),
      ),
    );

    if (this.shellProfile.enable_shell_integration) {
      this.terminalAutocompleteFeatureSuggestorService.preloadForShellIntegration(
        this.shellProfile.shell_type,
      );
      this.disposables.push(
        this.renderer.register(
          new CommandLineObserver(
            this.stateManager,
            this.configService.getPromptSegments(),
            this.contextMenuOverlayService,
            this.bus,
            this.completedCommandNotificationHandler.handleCompletedCommand,
          ),
        ),
      );
      this.disposables.push(
        this.renderer.register(
          new CommandLineEditor(this.bus, this.pty, this.stateManager, shellDefinition?.lineEditor),
        ),
      );
    }
  }

  buildContextMenu(): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
      {
        label: "Paste",
        action: async () => {
          this.focusHandler?.focus();
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
          this.focusHandler?.focus();
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
          this.focusHandler?.focus();
          this.bus.publish({ path: ["app", "action"], type: "ActionFired", payload: "copy" });
        },
        keybinding: this.keybindingFor("copy"),
      });
    }
    return items;
  }

  private keybindingFor(actionName: ActionName): string {
    return formatKeybinding(this.keybindService.getKeybinding(actionName));
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
    this.focusHandler?.focus();
  }

  scrollToBottom(): void {
    this.renderer.terminal.scrollToBottom();
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
      type: "InjectTerminalInput",
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
    return [
      {
        id: OSC9_NOTIFICATION_ID,
        label: "Terminal Notifications (OSC9)",
        defaultEnabled: notificationsConfig?.osc9?.enabled ?? true,
      },
      {
        id: LONG_RUNNING_COMMAND_NOTIFICATION_ID,
        label: "Long Running Commands",
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
      appBus: this.bus,
      terminalId: this.terminalId,
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
