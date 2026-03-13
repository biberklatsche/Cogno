import { Injectable } from "@angular/core";
import type {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
} from "@cogno/core-sdk";
import { NotificationOs } from "../../_tauri/notification";

@Injectable({ providedIn: "root" })
export class OsNotificationChannelService implements NotificationChannelContract {
  readonly displayName = "OS";
  readonly id = "os";
  readonly sortOrder = 200;

  async dispatch(notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract): Promise<void> {
    await NotificationOs.send(
      notificationChannelDispatchRequest.notification.header,
      notificationChannelDispatchRequest.notification.body,
    );
  }
}
