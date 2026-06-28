import { Injectable } from "@angular/core";
import {
  NotificationChannelOptionContract,
  NotificationChannelsPortContract,
} from "@cogno/core-api";
import { AppWiringService } from "../../app-host/app-wiring.service";
import { ConfigService } from "../../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class NotificationChannelsPortAdapterService implements NotificationChannelsPortContract {
  constructor(
    private readonly wiringService: AppWiringService,
    private readonly configService: ConfigService,
  ) {}

  getAvailableChannels(): ReadonlyArray<NotificationChannelOptionContract> {
    const notificationsConfig = this.configService.config.notification?.channel as
      | Readonly<Record<string, { readonly available?: boolean; readonly enabled?: boolean }>>
      | undefined;

    return this.wiringService
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
