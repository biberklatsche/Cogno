import { Injectable } from "@angular/core";
import { NotificationCenterPortContract } from "@cogno/core/api/notification-center-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { map, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class NotificationCenterPortAdapterService implements NotificationCenterPortContract {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;

  constructor(private readonly appBus: AppBus) {
    this.notificationEvents$ = this.appBus.on$("Notification").pipe(
      map((notificationEvent) => {
        if (!notificationEvent.payload) {
          throw new Error("Notification payload must be defined.");
        }
        return notificationEvent.payload;
      }),
    );
  }

  openTarget(target: NotificationTargetContract): void {
    this.appBus.publish({
      type: "OpenNotificationTarget",
      payload: target,
    });
  }

  dispatch(payload: NotificationEventPayloadContract): void {
    this.appBus.publish({
      type: "Notification",
      payload,
    });
  }
}
