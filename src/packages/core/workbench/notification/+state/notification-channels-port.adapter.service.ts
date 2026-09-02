import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { NotificationChannelsSource } from "@cogno/core/workbench/notification/notification-channels.source";
import {
  NotificationChannelOptionContract,
  NotificationChannelsPortContract,
} from "@cogno/shared/ports";

@Injectable({ providedIn: "root" })
export class NotificationChannelsPortAdapterService implements NotificationChannelsPortContract {
  constructor(
    private readonly channelsSource: NotificationChannelsSource,
    private readonly configService: ConfigService,
  ) {}

  getAvailableChannels(): ReadonlyArray<NotificationChannelOptionContract> {
    const notificationsConfig = this.configService.config.notification?.channel as
      | Readonly<Record<string, { readonly available?: boolean; readonly enabled?: boolean }>>
      | undefined;

    return this.channelsSource
      .getNotificationChannels()
      .filter((notificationChannel) => {
        const notificationChannelConfiguration = notificationsConfig?.[notificationChannel.id];
        return (
          (notificationChannelConfiguration?.available ?? true) &&
          (notificationChannel.isAvailable?.() ?? true)
        );
      })
      .sort(
        (leftNotificationChannel, rightNotificationChannel) =>
          rightNotificationChannel.sortOrder - leftNotificationChannel.sortOrder,
      )
      .map((notificationChannel) => ({
        id: notificationChannel.id,
        displayName: notificationChannel.displayName,
        defaultEnabled: notificationsConfig?.[notificationChannel.id]?.enabled ?? false,
      }));
  }
}
