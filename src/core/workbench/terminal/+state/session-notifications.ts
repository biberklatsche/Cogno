import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import { isNotificationEventEnabled, TerminalId } from "@cogno/shared/domain";
import { Subscription } from "rxjs";
import { CompletedCommandNotificationHandler } from "./handler/completed-command-notification.handler";
import { OSC9_EVENT_ID, TERMINAL_NOTIFICATION_SOURCE_ID } from "./terminal-notification-source";

/**
 * Everything the app tells the user about one session: the OSC 9 message,
 * the long-running-command notice, the untrusted-sequence warning. Whether an
 * event notifies is config (`notification.source.terminal.*`); where it goes
 * is the dispatch's business, so nothing here names a channel.
 */
@Injectable()
export class SessionNotifications {
  private readonly subscription = new Subscription();
  private readonly completedCommandNotificationHandler: CompletedCommandNotificationHandler;

  constructor(
    private readonly bus: AppBus,
    private readonly host: SessionHost,
    private readonly configService: ConfigService,
    private readonly notificationTargetResolverService: NotificationTargetResolverService,
  ) {
    this.completedCommandNotificationHandler = new CompletedCommandNotificationHandler(
      this.configService,
      this.bus,
      () => this.host.terminalId,
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

  /** OSC 9 asked for attention: tell the user, if the config says so. */
  private notifyFromTerminal(message: string): void {
    if (
      !isNotificationEventEnabled(
        this.configService.config,
        TERMINAL_NOTIFICATION_SOURCE_ID,
        OSC9_EVENT_ID,
      )
    ) {
      return;
    }
    this.bus.publish({
      type: "Notification",
      payload: {
        header: "Terminal Notification",
        body: message,
        type: "info",
        timestamp: new Date(),
        terminalId: this.host.terminalId,
        target: this.resolveNotificationTarget(),
      },
    });
  }

  private resolveNotificationTarget() {
    const terminalId: TerminalId | undefined = this.host.terminalId;
    if (!terminalId) {
      return undefined;
    }
    return this.notificationTargetResolverService.resolveForTerminal(terminalId);
  }
}
