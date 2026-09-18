import { Injectable } from "@angular/core";
import { NotificationChannelContract } from "@cogno/shared/domain";
import { AppNotificationChannelService } from "./app-notification-channel.service";
import { OsNotificationChannelService } from "./os-notification-channel.service";

/**
 * The notification channels the workbench dispatches to and offers in the menu.
 * The built-in app and OS channels are always present; feature-contributed
 * channels are added and removed by the feature-host as features come and go
 * (ARCHITECTURE.md 6.1). The built-ins register here rather than through the
 * host - they are not a feature contribution.
 */
@Injectable({ providedIn: "root" })
export class NotificationChannelRegistry {
  private readonly channels = new Map<string, NotificationChannelContract>();

  constructor(
    appNotificationChannelService: AppNotificationChannelService,
    osNotificationChannelService: OsNotificationChannelService,
  ) {
    this.register(appNotificationChannelService);
    this.register(osNotificationChannelService);
  }

  register(channel: NotificationChannelContract): void {
    this.channels.set(channel.id, channel);
  }

  unregister(channelId: string): void {
    this.channels.delete(channelId);
  }

  getChannels(): ReadonlyArray<NotificationChannelContract> {
    return [...this.channels.values()];
  }
}
