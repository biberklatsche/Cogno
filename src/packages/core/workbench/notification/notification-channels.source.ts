import { NotificationChannelContract } from "@cogno/shared/domain";

/**
 * The notification channels features contribute. The workbench dispatches to
 * them and offers them in the menu; wiring the features together is done above
 * the workbench (ARCHITECTURE.md 3.1, "sources are injected").
 */
export abstract class NotificationChannelsSource {
  abstract getNotificationChannels(): ReadonlyArray<NotificationChannelContract>;
}
