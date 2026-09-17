import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import {
  buildNotificationPreferencesMenuItems,
  ChannelDefinitionContract,
  NotificationDefinitionContract,
  NotificationPreferencesState,
  NotificationPreferencesUseCase,
  TerminalId,
} from "@cogno/shared/domain";
import { NotificationChannelsPort } from "@cogno/shared/ports";
import { ContextMenuItem } from "@cogno/shared/ui";
import { Subscription } from "rxjs";
import {
  CompletedCommandNotificationHandler,
  DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS,
  LONG_RUNNING_COMMAND_NOTIFICATION_ID,
} from "./handler/completed-command-notification.handler";

const OSC9_NOTIFICATION_ID = "osc9";

/**
 * Everything the app tells the user about one session: the OSC 9 badge, the
 * long-running-command notice, the untrusted-sequence warning, and the
 * notification preferences the header menu offers. Deciding who is told is not
 * the session's business, so it lives here, per session, and listens to the
 * host's facts directly.
 */
@Injectable()
export class SessionNotifications {
  private readonly subscription = new Subscription();
  private readonly completedCommandNotificationHandler: CompletedCommandNotificationHandler;
  private notificationPreferencesState?: NotificationPreferencesState;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly configService: ConfigService,
    private readonly notificationTargetResolverService: NotificationTargetResolverService,
    private readonly notificationChannelsPort: NotificationChannelsPort,
  ) {
    this.completedCommandNotificationHandler = new CompletedCommandNotificationHandler(
      this.configService,
      this.bus,
      () => this.host.terminalId,
      () => this.getNotificationPreferencesState(),
      () => this.resolveNotificationTarget(),
    );
    this.subscription.add(this.host.facts$.subscribe((fact) => this.onFact(fact)));
  }

  dispose(): void {
    this.subscription.unsubscribe();
  }

  private onFact(fact: SessionFact): void {
    switch (fact.type) {
      case "commandCompleted":
        this.completedCommandNotificationHandler.handleCompletedCommand(fact.command);
        break;
      case "notificationRequested":
        this.notifyFromTerminal(fact.message);
        break;
      case "untrustedSequencesIgnored":
        this.bus.publish({
          type: "Notification",
          payload: {
            header: "Untrusted Cogno sequences ignored",
            body: `Something in this terminal's output pretends to be the Cogno shell integration; ${fact.count} sequences were ignored.`,
            type: "warning",
            timestamp: new Date(),
            terminalId: this.host.terminalId,
            target: this.resolveNotificationTarget(),
          },
        });
        break;
      default:
        break;
    }
  }

  /** OSC 9 asked for attention: check the preferences, then tell the user. */
  private notifyFromTerminal(message: string): void {
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
      payload: {
        header: "Terminal Notification",
        body: message,
        type: "info",
        timestamp: new Date(),
        terminalId: this.host.terminalId,
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
    const terminalId: TerminalId | undefined = this.host.terminalId;
    if (!terminalId) {
      return undefined;
    }
    return this.notificationTargetResolverService.resolveForTerminal(terminalId);
  }
}
