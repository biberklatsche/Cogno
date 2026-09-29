import { Injectable } from "@angular/core";
import { Limit, resolveLimit } from "@cogno/core/api/contributions";
import { NotificationCenterPortContract } from "@cogno/core/api/notification-center-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { map, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class NotificationCenterPortAdapterService implements NotificationCenterPortContract {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
  ) {
    this.notificationEvents$ = this.appBus.on$("Notification").pipe(
      map((notificationEvent) => {
        if (!notificationEvent.payload) {
          throw new Error("Notification payload must be defined.");
        }
        return notificationEvent.payload;
      }),
    );
  }

  getOverviewMaxItems(): number {
    const config = this.configService.config as {
      feature?: { notification_overview?: { overview?: { max_items?: Limit } } };
    };
    return resolveLimit(config.feature?.notification_overview?.overview?.max_items, 30);
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
