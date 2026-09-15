import { Injectable } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationOs, OsNotificationClickListener } from "@cogno/platform/notification";
import {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
} from "@cogno/shared/domain";

@Injectable({ providedIn: "root" })
export class OsNotificationChannelService implements NotificationChannelContract {
  readonly displayName = "OS";
  readonly id = "os";
  readonly sortOrder = 200;

  constructor(private readonly appBus: AppBus) {
    void OsNotificationClickListener.register((target) => {
      if (!target) {
        return;
      }
      this.appBus.publish({
        path: ["app", "notification"],
        type: "OpenNotificationTarget",
        payload: target,
      });
    });
  }

  async dispatch(
    notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract,
  ): Promise<void> {
    const osNotificationSendResult = await NotificationOs.send(
      notificationChannelDispatchRequest.notification.header,
      notificationChannelDispatchRequest.notification.body,
      notificationChannelDispatchRequest.notification.target,
    );

    if (
      osNotificationSendResult.status !== "skipped" ||
      osNotificationSendResult.reason !== "permission-denied"
    ) {
      return;
    }

    this.appBus.publish({
      path: ["notification"],
      type: "Notification",
      payload: {
        header: "OS notifications disabled",
        body: "Enable notifications for Cogno in your operating system settings.",
        type: "warning",
        timestamp: new Date(),
        channels: {
          app: true,
          os: false,
        },
      },
    });
  }
}
