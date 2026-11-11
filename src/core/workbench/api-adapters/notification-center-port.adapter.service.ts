import { Injectable } from "@angular/core";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationDispatchService } from "@cogno/core/workbench/notification/+state/notification-dispatch.service";
import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class NotificationCenterPortAdapterService implements NotificationCenterPort {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;

  constructor(
    private readonly appBus: AppBus,
    dispatch: NotificationDispatchService,
  ) {
    // What passed the gate, not the bus: a switched-off event never shows up.
    this.notificationEvents$ = dispatch.delivered$;
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
