import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { AutocompleteSuggestorSource } from "@cogno/core/session/autocomplete/autocomplete-suggestor.source";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { TerminalComposerService } from "@cogno/core/session/composer/terminal-composer.service";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { ActionFired, ActionFiredEvent } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import { TerminalActivityService } from "@cogno/core/workbench/terminal-activity/terminal-activity.service";
import { ShellLineEditorActionContract } from "@cogno/shared/contributions";
import {
  buildNotificationPreferencesMenuItems,
  ChannelDefinitionContract,
  NotificationDefinitionContract,
  NotificationPreferencesState,
  NotificationPreferencesUseCase,
} from "@cogno/shared/domain";
import { NotificationChannelsPort, TerminalId } from "@cogno/shared/ports";
import { ContextMenuItem } from "@cogno/shared/ui";
import { Subscription } from "rxjs";
import {
  CompletedCommandNotificationHandler,
  DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS,
  LONG_RUNNING_COMMAND_NOTIFICATION_ID,
} from "./handler/completed-command-notification.handler";
import { KeybindExecutor } from "./keybind/keybind.executor";
import { TerminalSessionRegistry } from "./terminal-session.registry";

export const OSC9_NOTIFICATION_ID = "osc9";

const EDITOR_ACTION_BY_MESSAGE = {
  ClearLine: "clearLine",
  ClearLineToEnd: "clearLineToEnd",
  ClearLineToStart: "clearLineToStart",
  DeletePreviousWord: "deletePreviousWord",
  DeleteNextWord: "deleteNextWord",
  GoToNextWord: "goToNextWord",
  GoToPreviousWord: "goToPreviousWord",
  GoToStartOfLine: "goToStartOfLine",
  GoToEndOfLine: "goToEndOfLine",
  SelectAll: "selectAll",
  SelectTextRight: "selectTextRight",
  SelectTextLeft: "selectTextLeft",
  SelectWordRight: "selectWordRight",
  SelectWordLeft: "selectWordLeft",
  SelectTextToEndOfLine: "selectTextToEndOfLine",
  SelectTextToStartOfLine: "selectTextToStartOfLine",
} as const satisfies Record<string, ShellLineEditorActionContract>;

/**
 * The only translator between a session host and the old app bus, in both
 * directions: facts become the bus messages the rest of the app still
 * listens to, bus messages addressed to this terminal become host methods.
 * Notification preferences and the Notification payloads built from them
 * live here too - deciding who is told is not the session's business.
 *
 * Goes away with the bus once the workbench listens to facts itself.
 */
@Injectable()
export class SessionFactBridge {
  private readonly subscription = new Subscription();
  private readonly completedCommandNotificationHandler: CompletedCommandNotificationHandler;
  private notificationPreferencesState?: NotificationPreferencesState;
  private terminalId?: TerminalId;
  private keybindExecutor?: KeybindExecutor;
  private disposed = false;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly configService: ConfigService,
    private readonly terminalActivity: TerminalActivityService,
    private readonly notificationTargetResolverService: NotificationTargetResolverService,
    private readonly notificationChannelsPort: NotificationChannelsPort,
    private readonly featureSuggestorService: AutocompleteSuggestorSource,
    private readonly registry: TerminalSessionRegistry,
    private readonly autocomplete: TerminalAutocompleteService,
    private readonly history: TerminalHistoryService,
    // Listens to the host's facts itself; injected so it exists for the session.
    _composer: TerminalComposerService,
  ) {
    this.completedCommandNotificationHandler = new CompletedCommandNotificationHandler(
      this.configService,
      this.bus,
      () => this.terminalId,
      () => this.getNotificationPreferencesState(),
      () => this.resolveNotificationTarget(),
    );
  }

  /** Starts translating for `terminalId`; the host must be initialized already. */
  start(terminalId: TerminalId, shellProfile: ShellProfile): void {
    this.terminalId = terminalId;
    this.registry.register(terminalId, shellProfile, this.host);
    if (shellProfile.enable_shell_integration) {
      this.featureSuggestorService.preloadForShellIntegration(shellProfile.shell_type);
    }
    this.subscription.add(this.host.facts$.subscribe((fact) => this.onFact(terminalId, fact)));
    this.listenToBus(terminalId);
    this.keybindExecutor = new KeybindExecutor(this.bus, this.host);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.registry.unregister(this.terminalId);
    if (this.terminalId) {
      this.bus.publish({
        type: "TerminalRemoved",
        path: ["app", "terminal"],
        payload: this.terminalId,
      });
    }
    this.keybindExecutor?.dispose();
    this.subscription.unsubscribe();
  }

  // ---- facts -> bus ------------------------------------------------------

  private onFact(terminalId: TerminalId, fact: SessionFact): void {
    switch (fact.type) {
      case "cwdReported":
        this.bus.publish({
          path: ["app", "terminal", terminalId],
          payload: { cwd: fact.cwd, terminalId },
          type: "TerminalCwdChanged",
        });
        break;
      case "busyChanged":
        this.bus.publish({
          path: ["app", "terminal"],
          type: "TerminalBusyChanged",
          payload: { terminalId, isBusy: fact.isBusy },
        });
        break;
      case "commandCompleted":
        this.completedCommandNotificationHandler.handleCompletedCommand(fact.command);
        break;
      case "filterBlockRequested":
        this.bus.publish(ActionFired.create("open_terminal_search"));
        this.bus.publish({
          path: ["app", "terminal"],
          type: "TerminalSearchPanelRequested",
          payload: {
            terminalId,
            beginBufferLine: fact.range.beginBufferLine,
            endBufferLine: fact.range.endBufferLine,
          },
        });
        break;
      case "titleChanged":
        this.bus.publish({
          type: "TerminalTitleChanged",
          payload: { oscCode: fact.oscCode, terminalId, title: fact.title },
        });
        break;
      case "notificationRequested":
        this.notifyFromTerminal(terminalId, fact.message);
        break;
      case "fullScreenChanged":
        this.bus.publish({
          type: fact.active ? "FullScreenAppEntered" : "FullScreenAppLeaved",
          path: ["app", "terminal", terminalId],
          payload: terminalId,
        });
        break;
      case "commandHistoryRequested":
        void this.history.triggerCommandHistory();
        break;
      case "untrustedSequencesIgnored":
        this.bus.publish({
          type: "Notification",
          path: ["notification"],
          payload: {
            header: "Untrusted Cogno sequences ignored",
            body: `Something in this terminal's output pretends to be the Cogno shell integration; ${fact.count} sequences were ignored.`,
            type: "warning",
            timestamp: new Date(),
            terminalId,
            target: this.resolveNotificationTarget(),
          },
        });
        break;
      case "searchResult":
        this.bus.publish({
          path: ["app", "terminal"],
          type: "TerminalSearchResult",
          payload: fact.result,
        });
        break;
      case "started":
        this.bus.publish({
          path: ["app", "terminal", terminalId],
          type: "PtyInitialized",
          payload: { terminalId, shellType: fact.shellType as ShellType },
        });
        break;
      case "exited":
        this.bus.publish({ path: ["app", "terminal"], type: "RemovePane", payload: terminalId });
        break;
      case "outputReceived":
        this.terminalActivity.emit(terminalId);
        break;
      case "focusChanged":
        this.bus.publish({
          type: fact.focused ? "TerminalFocused" : "TerminalBlurred",
          payload: terminalId,
        });
        break;
      case "promptReported":
      case "paddingChanged":
      case "composerRequested":
      case "startFailed":
        // session-internal; the host, the composer and the pane react themselves
        break;
    }
  }

  // ---- bus -> host -------------------------------------------------------

  private listenToBus(terminalId: TerminalId): void {
    const add = (subscription: Subscription) => this.subscription.add(subscription);
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "FocusTerminal" }).subscribe((event) => {
        if (event.payload === terminalId) this.host.focus();
        else this.host.blur();
      }),
    );
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "BlurTerminal" }).subscribe((event) => {
        if (event.payload === terminalId) this.host.blur();
      }),
    );
    add(
      this.bus.onType$("PaneMaximizedChanged").subscribe((event) => {
        this.host.setPaneMaximized(event.payload?.terminalId === terminalId);
      }),
    );
    add(
      this.bus.onType$("VisibleTerminalsChanged").subscribe((event) => {
        this.host.setVisible(event.payload?.terminalIds.includes(terminalId) ?? true);
      }),
    );
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "ClearBuffer" }).subscribe((event) => {
        if (event.payload === terminalId) this.host.clearBuffer();
      }),
    );
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "WriteRawToPty" }).subscribe((event) => {
        if (event.payload?.terminalId !== terminalId) return;
        this.host.writeRaw(event.payload.text, event.payload.autoExecute);
      }),
    );
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "Paste" }).subscribe((event) => {
        if (event.payload === terminalId) void this.host.paste();
      }),
    );
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "Copy" }).subscribe((event) => {
        if (event.payload === terminalId) void this.host.copy();
      }),
    );
    add(
      this.bus.on$({ path: ["app", "terminal"], type: "Cut" }).subscribe((event) => {
        if (event.payload === terminalId) this.host.cut();
      }),
    );
    add(
      this.bus.on$(ActionFired.listener()).subscribe(async (event: ActionFiredEvent) => {
        const performed = await this.performAction(event.payload ?? "");
        if (!performed) return;
        event.performed = true;
        event.defaultPrevented = true;
        event.propagationStopped = true;
      }),
    );
    for (const [type, actionId] of Object.entries(EDITOR_ACTION_BY_MESSAGE)) {
      add(
        this.bus
          .on$({ path: ["app", "terminal"], type: type as keyof typeof EDITOR_ACTION_BY_MESSAGE })
          .subscribe((event) => {
            if (event.payload === terminalId) this.host.runEditorAction(actionId);
          }),
      );
    }
    add(
      this.bus
        .on$({ path: ["app", "terminal"], type: "TerminalSearchRequested" })
        .subscribe((event) => {
          const payload = event.payload;
          if (!payload || (payload.terminalId && payload.terminalId !== terminalId)) return;
          this.host.search(payload);
        }),
    );
    add(
      this.bus
        .on$({ path: ["app", "terminal"], type: "TerminalSearchRevealRequested" })
        .subscribe((event) => {
          if (event.payload?.terminalId !== terminalId) return;
          this.host.reveal(event.payload);
        }),
    );
  }

  /** The keybinding actions the session's dropdowns answer to. */
  private performAction(action: string): Promise<boolean> | boolean {
    switch (action) {
      case "trigger_autocomplete":
        return this.autocomplete.triggerAutocomplete();
      case "trigger_command_history":
        return this.history.triggerCommandHistory();
      case "cycle_tab":
        return this.autocomplete.cycleTab() || this.history.cycleTab();
      default:
        return false;
    }
  }

  // ---- notifications -----------------------------------------------------

  /** OSC 9 asked for attention: check the preferences, then tell the user. */
  private notifyFromTerminal(terminalId: TerminalId, message: string): void {
    const notificationPreferencesState = this.getNotificationPreferencesState();
    if (
      !NotificationPreferencesUseCase.shouldNotify(
        notificationPreferencesState,
        OSC9_NOTIFICATION_ID,
      )
    ) {
      return;
    }
    this.host.model.markUnreadNotification();
    this.bus.publish({
      type: "Notification",
      path: ["notification"],
      payload: {
        header: "Terminal Notification",
        body: message,
        type: "info",
        timestamp: new Date(),
        terminalId,
        target: this.resolveNotificationTarget(),
        channels: NotificationPreferencesUseCase.getActiveChannels(notificationPreferencesState),
      },
    });
  }

  buildNotificationMenuItems(): ContextMenuItem[] {
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

  private resolveNotificationTarget() {
    if (!this.terminalId) {
      return undefined;
    }
    return this.notificationTargetResolverService.resolveForTerminal(this.terminalId);
  }
}
