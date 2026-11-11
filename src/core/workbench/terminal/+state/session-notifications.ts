import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { SessionFact } from "@cogno/core/session/session-facts";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import { TerminalId } from "@cogno/shared/domain";
import { Subscription } from "rxjs";
import { CompletedCommandNotificationHandler } from "./handler/completed-command-notification.handler";
import { OSC9_EVENT_ID, TERMINAL_NOTIFICATION_SOURCE_ID } from "./terminal-notification-source";

/**
 * Everything the app tells the user about one session: the OSC 9 message,
 * the long-running-command notice, the untrusted-sequence warning, the
 * confirmation that a clicked link was copied. Whether an
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
        this.notifyFromTerminal(fact.message, fact.title);
        break;
      case "linkCopied":
        this.confirmLinkCopied(fact.target);
        break;
      case "untrustedSequencesIgnored":
        this.warn(
          "Untrusted Cogno sequences ignored",
          `Something in this terminal's output pretends to be the Cogno shell integration; ${fact.count} sequences were ignored.`,
        );
        break;
      case "integrationMissing":
        this.warn(
          "Shell integration did not load",
          `The ${fact.shellType} shell started, but Cogno's integration never answered. Commands, directory and history are not tracked in this terminal; check the shell's startup files.`,
        );
        break;
      case "outputDegraded":
        this.warn(
          fact.reason === "chunksLost"
            ? "Terminal output was lost"
            : "Terminal output acknowledgement failed",
          `${fact.detail}. What the shell prints may be incomplete; if it seems stuck, press Enter or restart the terminal.`,
        );
        break;
      default:
        break;
    }
  }

  /** Something degraded in this session: always told, no preference gates it. */
  private warn(header: string, body: string): void {
    this.bus.publish({
      type: "Notification",
      payload: {
        header,
        body,
        type: "warning",
        timestamp: new Date(),
        terminalId: this.host.terminalId,
        target: this.resolveNotificationTarget(),
      },
    });
  }

  /** A program asked for attention (OSC 9 / 777); whether it is shown is the dispatch's call. */
  private notifyFromTerminal(message: string, title: string | undefined): void {
    this.bus.publish({
      type: "Notification",
      payload: {
        event: { source: TERMINAL_NOTIFICATION_SOURCE_ID, id: OSC9_EVENT_ID },
        header: title ?? "Terminal Notification",
        body: message,
        type: "info",
        timestamp: new Date(),
        terminalId: this.host.terminalId,
        target: this.resolveNotificationTarget(),
      },
    });
  }

  /**
   * The answer to a click the user just made in this terminal: a toast if
   * they have toasts on, never a system notification or an unread mark.
   */
  private confirmLinkCopied(target: string): void {
    this.bus.publish({
      type: "Notification",
      payload: {
        header: "Copied to clipboard",
        body: target,
        type: "info",
        timestamp: new Date(),
        channels: { os: false, badge: false },
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
