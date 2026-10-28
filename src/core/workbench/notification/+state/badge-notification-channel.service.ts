import { Injectable } from "@angular/core";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
} from "@cogno/shared/domain";

/**
 * The unread mark on a terminal's tab: a channel like the toast and the OS
 * notification, so every source reaches it the same way and the config
 * switches it like the others. Only a notification that belongs to a
 * terminal has a tab to mark; the session clears the mark when the terminal
 * is focused or typed into.
 */
@Injectable({ providedIn: "root" })
export class BadgeNotificationChannelService implements NotificationChannelContract {
  readonly displayName = "Tab badge";
  readonly id = "badge";
  readonly sortOrder = 300;

  constructor(private readonly sessions: TerminalSessionRegistry) {}

  dispatch({ notification }: NotificationChannelDispatchRequestContract): void {
    if (!notification.terminalId) return;
    this.sessions.get(notification.terminalId)?.host.model.markUnreadNotification();
  }
}
