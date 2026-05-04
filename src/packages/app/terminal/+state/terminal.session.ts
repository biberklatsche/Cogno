import { Injectable } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { NotificationChannelContract, ShellDefinitionContract } from "@cogno/core-api";
import { Observable, Subscription } from "rxjs";
import { AppBus } from "../../app-bus/app-bus";
import { TerminalAutocompleteFeatureSuggestorService } from "../../app-host/terminal-autocomplete-feature-suggestor.service";
import { DialogRef, DialogService } from "../../common/dialog";
import { IDisposable } from "../../common/models/models";
import { ShellProfile } from "../../config/+models/shell-config";
import { ConfigService } from "../../config/+state/config.service";
import { PaneMaximizedChangedEvent } from "../../grid-list/+bus/events";
import { TerminalId } from "../../grid-list/+model/model";
import { ContextMenuOverlayService } from "../../menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "../../menu/context-menu-overlay/context-menu-overlay.types";
import { NotificationChannels } from "../../notification/+bus/events";
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
import { CompletedCommandNotificationHandler } from "./handler/completed-command-notification.handler";
import { CursorHandler } from "./handler/cursor.handler";
import { FocusHandler } from "./handler/focus.handler";
import { FullScreenAppHandler } from "./handler/full-screen-app.handler";
import { InputHandler } from "./handler/input.handler";
import { LinkHandler } from "./handler/link.handler";
import { MouseHandler } from "./handler/mouse.handler";
import { PtyHandler } from "./handler/pty.handler";
import { ResizeHandler } from "./handler/resize.handler";
import { ScrollStateHandler } from "./handler/scroll-state.handler";
import { SelectionHandler } from "./handler/selection.handler";
import { TerminalNotificationHandler } from "./handler/terminal-notification.handler";
import { TerminalSearchHandler } from "./handler/terminal-search.handler";
import { TerminalTitleHandler } from "./handler/terminal-title.handler";
import { ThemeHandler } from "./handler/theme.handler";
import { KeybindExecutor } from "./keybind/keybind.executor";
import { IPty, Pty } from "./pty/pty";
import { IRenderer, Renderer } from "./renderer/renderer";
import { TerminalStateManager } from "./state";
import { TerminalSessionRegistry } from "./terminal-session.registry";

type NotificationChannelId = string;

@Injectable()
export class TerminalSession {
  private renderer: IRenderer;
  private pty: IPty = new Pty();

  private focusHandler?: FocusHandler = undefined;

  private subscription: Subscription = new Subscription();
  private readonly disposables: IDisposable[];
  private disposed: boolean = false;
  private processInfoDialogReference?: DialogRef<void>;
  private sessionNotificationChannels?: NotificationChannels;
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
    private terminalSessionRegistry: TerminalSessionRegistry = new TerminalSessionRegistry(),
  ) {
    this.renderer = new Renderer(this.configService.config);
    this.disposables = [this.renderer, this.pty];
    this.completedCommandNotificationHandler = new CompletedCommandNotificationHandler(
      this.configService,
      this.bus,
      () => this.terminalId,
      () => this.getSessionNotificationChannels(),
      () => this.resolveNotificationTarget(),
    );
    this.commandBlockResolver = new CommandBlockResolver(() => this.renderer.terminal);
  }

  initialize(terminalId: TerminalId, shellProfile: ShellProfile): void {
    this.terminalId = terminalId;
    this.shellProfile = shellProfile;
    this.terminalSessionRegistry.register(terminalId, shellProfile, this, this.stateManager);
    this.sessionNotificationChannels = this.getDefaultSessionNotificationChannels();
    this.completedCommandNotificationHandler.initialize();
    if (!shellProfile.shell_type) {
      throw new Error("Shell profile must define a shell type.");
    }
    this.stateManager.initialize(terminalId, shellProfile.shell_type, shellProfile);
    this.subscription.add(
      this.bus.onType$("PaneMaximizedChanged").subscribe((event: PaneMaximizedChangedEvent) => {
        this.stateManager.setPaneMaximized(event.payload?.terminalId === this.terminalId);
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
        new PtyHandler(this.terminalId, this.pty, this.shellProfile, this.bus),
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
          () => ({
            ...this.getSessionNotificationChannels(),
          }),
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
    this.disposables.push(
      this.renderer.register(
        new SelectionHandler(this.bus, this.configService, this.terminalId, this.stateManager),
      ),
    );
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
    this.disposables.push(this.renderer.register(new LinkHandler(this.stateManager)));
    this.disposables.push(new KeybindExecutor(this.bus, this.stateManager));

    if (this.shellProfile.enable_shell_integration) {
      this.terminalAutocompleteFeatureSuggestorService.preloadForShellIntegration(
        this.shellProfile.shell_type,
      );
      const shellDefinition = this.wiringService
        .getShellDefinitions()
        .find(
          (definition: ShellDefinitionContract) =>
            definition.support.shellType === this.shellProfile?.shell_type,
        );
      this.disposables.push(
        this.renderer.register(
          new InputHandler(
            this.bus,
            this.terminalId,
            this.stateManager,
            this.pty,
            shellDefinition?.lineEditor,
          ),
        ),
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
    } else {
      this.disposables.push(
        this.renderer.register(
          new InputHandler(this.bus, this.terminalId, this.stateManager, this.pty),
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
        actionName: "paste",
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
        actionName: "split_right",
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
        actionName: "split_left",
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
        actionName: "split_down",
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
        actionName: "split_up",
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
            actionName: "minimize_pane",
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
            actionName: "maximize_pane",
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
        actionName: "clear_buffer",
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
        actionName: "close_terminal",
      },
    ];

    if (this.stateManager.hasSelection) {
      items.unshift({
        label: "Copy",
        action: () => {
          this.focusHandler?.focus();
          this.bus.publish({ path: ["app", "action"], type: "ActionFired", payload: "copy" });
        },
        actionName: "copy",
      });
    }
    return items;
  }

  buildHeaderMenu(): ContextMenuItem[] {
    const items: ContextMenuItem[] = this.buildNotificationContextMenuItems();
    items.push({
      label: "Process Info",
      action: () => this.openProcessInfoDialog(),
    });
    return items;
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
    const availableNotificationChannels = this.getAvailableNotificationChannels();
    const items: ContextMenuItem[] = [];

    items.push({ header: true, label: "Command Alerts" });
    items.push({
      label: "Long Commands",
      toggle: true,
      toggled: this.completedCommandNotificationHandler.isLongRunningCommandNotificationEnabled(),
      closeOnSelect: false,
      action: (item?: ContextMenuItem) =>
        this.completedCommandNotificationHandler.toggleLongRunningCommandNotifications(item),
    });

    if (availableNotificationChannels.length === 0) {
      return [];
    }

    const channels = this.getSessionNotificationChannels();
    items.push({ separator: true });
    items.push({ header: true, label: "Channels" });

    for (const notificationChannel of availableNotificationChannels) {
      items.push({
        label: notificationChannel.displayName,
        toggle: true,
        toggled: channels[notificationChannel.id] ?? false,
        closeOnSelect: false,
        action: (item?: ContextMenuItem) =>
          this.toggleSessionNotificationChannel(notificationChannel.id, item),
      });
    }

    items.push({ separator: true });

    return items;
  }

  private getSessionNotificationChannels(): NotificationChannels {
    if (!this.sessionNotificationChannels) {
      this.sessionNotificationChannels = this.getDefaultSessionNotificationChannels();
    }
    return this.sessionNotificationChannels;
  }

  private toggleSessionNotificationChannel(
    notificationChannelId: NotificationChannelId,
    item?: ContextMenuItem,
  ): void {
    const availability = this.getNotificationAvailability();
    if (!availability[notificationChannelId]) {
      return;
    }

    const channels = this.getSessionNotificationChannels();
    const nextValue = !(channels[notificationChannelId] ?? false);
    this.sessionNotificationChannels = {
      ...channels,
      [notificationChannelId]: nextValue,
    };
    if (item?.toggle) {
      item.toggled = nextValue;
    }
  }

  private getDefaultSessionNotificationChannels(): NotificationChannels {
    const availability = this.getNotificationAvailability();
    const defaults = this.getNotificationDefaults();
    const notificationChannels: Record<string, boolean> = {};
    for (const notificationChannel of this.getRegisteredNotificationChannels()) {
      notificationChannels[notificationChannel.id] =
        (availability[notificationChannel.id] ?? false) &&
        (defaults[notificationChannel.id] ?? false);
    }
    return notificationChannels;
  }

  private getNotificationAvailability(): NotificationChannels {
    const notificationsConfig = this.configService.config.notifications as
      | Readonly<Record<string, { readonly available?: boolean }>>
      | undefined;
    const notificationAvailability: Record<string, boolean> = {};

    for (const notificationChannel of this.getRegisteredNotificationChannels()) {
      const notificationChannelConfiguration = notificationsConfig?.[notificationChannel.id];
      notificationAvailability[notificationChannel.id] =
        (notificationChannelConfiguration?.available ?? true) &&
        (notificationChannel.isAvailable?.() ?? true);
    }

    return notificationAvailability;
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

  private getNotificationDefaults(): NotificationChannels {
    const notificationsConfig = this.configService.config.notifications as
      | Readonly<Record<string, { readonly enabled?: boolean }>>
      | undefined;
    const notificationDefaults: Record<string, boolean> = {};

    for (const notificationChannel of this.getRegisteredNotificationChannels()) {
      notificationDefaults[notificationChannel.id] =
        notificationsConfig?.[notificationChannel.id]?.enabled ?? false;
    }

    return notificationDefaults;
  }

  private getAvailableNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    const availability = this.getNotificationAvailability();
    return this.getRegisteredNotificationChannels()
      .filter((notificationChannel) => availability[notificationChannel.id] ?? false)
      .sort(
        (leftNotificationChannel, rightNotificationChannel) =>
          rightNotificationChannel.sortOrder - leftNotificationChannel.sortOrder,
      );
  }

  private getRegisteredNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    return this.wiringService.getNotificationChannels();
  }

  private resolveNotificationTarget() {
    if (!this.terminalId) {
      return undefined;
    }

    return this.notificationTargetResolverService.resolveForTerminal(this.terminalId);
  }
}
