import { NotificationSourceContract } from "@cogno/core/api/contributions";
import { ERROR_NOTIFICATION_SOURCE } from "@cogno/core/workbench/error/error-notification-source";
import { TERMINAL_NOTIFICATION_SOURCE } from "@cogno/core/workbench/terminal/+state/terminal-notification-source";

/** The sources core itself brings; features add theirs through their definition. */
export const CORE_NOTIFICATION_SOURCES: ReadonlyArray<NotificationSourceContract> = [
  TERMINAL_NOTIFICATION_SOURCE,
  ERROR_NOTIFICATION_SOURCE,
];
