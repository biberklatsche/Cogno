import { AppBus } from "../../../app-bus/app-bus";
import { timespan } from "../../../common/timespan/timespan";
import { ConfigService } from "../../../config/+state/config.service";
import { TerminalId } from "../../../grid-list/+model/model";
import { ContextMenuItem } from "../../../menu/context-menu-overlay/context-menu-overlay.types";
import { NotificationChannels } from "../../../notification/+bus/events";
import { ExecutedCommand } from "../advanced/history/terminal-command-history.store";

export class CompletedCommandNotificationHandler {
  private longRunningCommandNotificationsEnabled?: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly appBus: AppBus,
    private readonly terminalIdResolver: () => TerminalId | undefined,
    private readonly notificationChannelsResolver: () => NotificationChannels,
  ) {}

  initialize(): void {
    this.longRunningCommandNotificationsEnabled =
      this.getDefaultLongRunningCommandNotificationsEnabled();
  }

  isLongRunningCommandNotificationEnabled(): boolean {
    if (this.longRunningCommandNotificationsEnabled === undefined) {
      this.longRunningCommandNotificationsEnabled =
        this.getDefaultLongRunningCommandNotificationsEnabled();
    }

    return this.longRunningCommandNotificationsEnabled;
  }

  toggleLongRunningCommandNotifications(item?: ContextMenuItem): void {
    const nextValue = !this.isLongRunningCommandNotificationEnabled();
    this.longRunningCommandNotificationsEnabled = nextValue;
    if (item?.toggle) {
      item.toggled = nextValue;
    }
  }

  readonly handleCompletedCommand = (executedCommand: ExecutedCommand): void => {
    if (!this.isLongRunningCommandNotificationEnabled()) {
      return;
    }

    const minimumDurationMilliseconds = this.getLongRunningCommandMinimumDurationMilliseconds();
    const commandDurationMilliseconds = executedCommand.duration;
    if (
      commandDurationMilliseconds === undefined ||
      commandDurationMilliseconds < minimumDurationMilliseconds
    ) {
      return;
    }

    const terminalId = this.terminalIdResolver();
    const notificationChannels = this.notificationChannelsResolver();
    if (!terminalId || !this.hasEnabledNotificationChannels(notificationChannels)) {
      return;
    }

    this.appBus.publish({
      type: "Notification",
      path: ["notification"],
      payload: {
        header: "Long-running command finished",
        body: this.renderLongRunningCommandNotificationBody(executedCommand),
        type: executedCommand.returnCode && executedCommand.returnCode !== 0 ? "warning" : "info",
        timestamp: new Date(),
        terminalId,
        channels: notificationChannels,
      },
    });
  };

  private getDefaultLongRunningCommandNotificationsEnabled(): boolean {
    return this.configService.config.notification?.long_running_commands?.enabled ?? true;
  }

  private getLongRunningCommandMinimumDurationMilliseconds(): number {
    const minimumDurationSeconds =
      this.configService.config.notification?.long_running_commands?.minimum_duration_seconds ?? 10;
    return minimumDurationSeconds * 1000;
  }

  private hasEnabledNotificationChannels(notificationChannels: NotificationChannels): boolean {
    return Object.values(notificationChannels).some(Boolean);
  }

  private renderLongRunningCommandNotificationBody(executedCommand: ExecutedCommand): string {
    const commandLine = executedCommand.command.trim();
    const details: string[] = [`Duration: ${this.formatDuration(executedCommand.duration)}`];

    if (executedCommand.returnCode !== undefined) {
      details.push(`Exit code: ${executedCommand.returnCode}`);
    }

    return `${commandLine}\n${details.join(" | ")}`;
  }

  private formatDuration(durationMilliseconds: number | undefined): string {
    if (durationMilliseconds === undefined) {
      return "unknown";
    }

    return timespan(durationMilliseconds);
  }
}
