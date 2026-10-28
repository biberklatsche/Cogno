import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ExecutedCommand } from "@cogno/core/session/recorder/executed-command";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import {
  isNotificationEventEnabled,
  NotificationTargetContract,
  notificationEventSettings,
  TerminalId,
} from "@cogno/shared/domain";
import { timespan } from "@cogno/shared/support";
import {
  DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS,
  LONG_RUNNING_COMMAND_EVENT_ID,
  TERMINAL_NOTIFICATION_SOURCE_ID,
} from "../terminal-notification-source";

/** A command that ran at least as long as the config asks for has finished: say so. */
export class CompletedCommandNotificationHandler {
  constructor(
    private readonly configService: ConfigService,
    private readonly appBus: AppBus,
    private readonly terminalIdResolver: () => TerminalId | undefined,
    private readonly notificationTargetResolver: () => NotificationTargetContract | undefined,
  ) {}

  readonly handleCompletedCommand = (executedCommand: ExecutedCommand): void => {
    const config = this.configService.config;
    if (
      !isNotificationEventEnabled(
        config,
        TERMINAL_NOTIFICATION_SOURCE_ID,
        LONG_RUNNING_COMMAND_EVENT_ID,
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
      payload: {
        header: `Command finished after ${this.formatDuration(executedCommand.duration)}`,
        body: this.renderLongRunningCommandNotificationBody(executedCommand),
        type: executedCommand.returnCode && executedCommand.returnCode !== 0 ? "warning" : "info",
        timestamp: new Date(),
        terminalId,
        target: this.notificationTargetResolver(),
      },
    });
  };

  private getLongRunningCommandMinimumDurationMilliseconds(): number {
    const settings = notificationEventSettings(
      this.configService.config,
      TERMINAL_NOTIFICATION_SOURCE_ID,
      LONG_RUNNING_COMMAND_EVENT_ID,
    );
    const minimumDurationSeconds = settings?.["minimum_duration_seconds"];
    return (
      (typeof minimumDurationSeconds === "number"
        ? minimumDurationSeconds
        : DEFAULT_LONG_RUNNING_COMMAND_MINIMUM_DURATION_SECONDS) * 1000
    );
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
