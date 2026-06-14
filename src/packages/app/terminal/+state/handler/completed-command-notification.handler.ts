import { NotificationTargetContract, TerminalId } from "@cogno/core-api";
import { NotificationPreferencesState, NotificationPreferencesUseCase } from "@cogno/core-domain";
import { timespan } from "@cogno/core-support";
import { AppBus } from "../../../app-bus/app-bus";
import { ConfigService } from "../../../config/+state/config.service";
import { ExecutedCommand } from "../advanced/history/terminal-command-history.store";

export const LONG_RUNNING_COMMAND_NOTIFICATION_ID = "long_running_command";

export class CompletedCommandNotificationHandler {
  constructor(
    private readonly configService: ConfigService,
    private readonly appBus: AppBus,
    private readonly terminalIdResolver: () => TerminalId | undefined,
    private readonly notificationPreferencesStateResolver: () => NotificationPreferencesState,
    private readonly notificationTargetResolver: () => NotificationTargetContract | undefined,
  ) {}

  readonly handleCompletedCommand = (executedCommand: ExecutedCommand): void => {
    const notificationPreferencesState = this.notificationPreferencesStateResolver();
    if (
      !NotificationPreferencesUseCase.shouldNotify(
        notificationPreferencesState,
        LONG_RUNNING_COMMAND_NOTIFICATION_ID,
      )
    ) {
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
    if (!terminalId) {
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
        target: this.notificationTargetResolver(),
        channels: NotificationPreferencesUseCase.getActiveChannels(notificationPreferencesState),
      },
    });
  };

  private getLongRunningCommandMinimumDurationMilliseconds(): number {
    const minimumDurationSeconds =
      this.configService.config.terminal?.notifications?.long_running_command
        ?.minimum_duration_seconds ?? 10;
    return minimumDurationSeconds * 1000;
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
