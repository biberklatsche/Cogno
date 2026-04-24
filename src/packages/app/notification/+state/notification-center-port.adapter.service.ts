import { Injectable } from "@angular/core";
import {
  NotificationCenterPortContract,
  NotificationEventPayloadContract,
  NotificationTargetContract,
} from "@cogno/core-api";
import { map, Observable } from "rxjs";
import { AppBus } from "../../app-bus/app-bus";
import { ConfigService } from "../../config/+state/config.service";

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
    return this.configService.config.notification?.overview?.max_items ?? 30;
  }

  openTarget(target: NotificationTargetContract): void {
    this.appBus.publish({
      path: ["app", "notification"],
      type: "OpenNotificationTarget",
      payload: target,
    });
  }
}
