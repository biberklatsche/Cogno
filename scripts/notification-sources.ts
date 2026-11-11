import type { NotificationSourceContract } from "../src/core/api/contributions";
import { CORE_NOTIFICATION_SOURCES } from "../src/core/workbench/notification/+state/core-notification-sources";
import { CODING_AGENT_NOTIFICATION_SOURCE } from "../src/features/coding-agent/coding-agent-notification-source";

/**
 * Every notification source, as the app composes them at runtime: core's and
 * the features'. The generators build the default config and the reference
 * from it; a feature with a new source adds it here.
 */
export const ALL_NOTIFICATION_SOURCES: ReadonlyArray<NotificationSourceContract> = [
  ...CORE_NOTIFICATION_SOURCES,
  CODING_AGENT_NOTIFICATION_SOURCE,
];
