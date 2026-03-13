import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import {
  NotificationEventPayloadContract,
  NotificationHostPortContract,
  NotificationSettingsContract,
} from "@cogno/core-sdk";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";
import { NotificationOs } from "../_tauri/notification";

@Injectable({ providedIn: "root" })
export class NotificationHostPortAdapterService implements NotificationHostPortContract {
  readonly notificationEvent$: Observable<NotificationEventPayloadContract>;
  readonly notificationSettings$: Observable<NotificationSettingsContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
  ) {
    this.notificationEvent$ = this.appBus
      .on$({ type: "Notification", path: ["notification"] })
      .pipe(
        map((notificationEvent) => {
          const notificationPayload = notificationEvent.payload;
          if (!notificationPayload) {
            throw new Error("Notification payload must be defined.");
          }
          return notificationPayload;
        }),
      );

    this.notificationSettings$ = this.configService.config$.pipe(
      map((configuration) => {
        const notificationConfiguration = configuration.notification;
        return {
          appEnabled: notificationConfiguration?.app?.enabled ?? true,
          osEnabled: notificationConfiguration?.os?.enabled ?? false,
          telegramEnabled: notificationConfiguration?.telegram?.enabled ?? false,
          appAvailable: notificationConfiguration?.app?.available ?? true,
          osAvailable: notificationConfiguration?.os?.available ?? true,
          telegramAvailable: notificationConfiguration?.telegram?.available ?? true,
          appNotificationDurationSeconds:
            notificationConfiguration?.app?.notification_duration_seconds
            ?? notificationConfiguration?.app_notification_duration_seconds
            ?? 5,
          maxNotifications:
            notificationConfiguration?.max_notifications_in_overview
            ?? notificationConfiguration?.max_notifications
            ?? 30,
        };
      }),
    );
  }

  async sendOsNotification(header: string, body?: string): Promise<void> {
    await NotificationOs.send(header, body);
  }
}
