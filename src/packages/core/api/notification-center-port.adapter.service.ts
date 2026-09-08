import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { map, Observable } from "rxjs";
import { NotificationCenterPortContract } from "./notification-center-port";

@Injectable({ providedIn: "root" })
export class NotificationCenterPortAdapterService implements NotificationCenterPortContract {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
  ) {
    this.notificationEvents$ = this.appBus
      .on$({ path: ["notification"], type: "Notification" })
      .pipe(
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
      feature?: { notification_overview?: { overview?: { max_items?: number } } };
    };
    return config.feature?.notification_overview?.overview?.max_items ?? 30;
  }

  openTarget(target: NotificationTargetContract): void {
    this.appBus.publish({
      path: ["app", "notification"],
      type: "OpenNotificationTarget",
      payload: target,
    });
  }

  dispatch(payload: NotificationEventPayloadContract): void {
    this.appBus.publish({
      path: ["notification"],
      type: "Notification",
      payload,
    });
  }
}
