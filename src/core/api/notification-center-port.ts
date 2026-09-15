import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export interface NotificationCenterPortContract {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  getOverviewMaxItems(): number;
  openTarget(target: NotificationTargetContract): void;
  dispatch(payload: NotificationEventPayloadContract): void;
}

export abstract class NotificationCenterPort implements NotificationCenterPortContract {
  abstract readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  abstract getOverviewMaxItems(): number;
  abstract openTarget(target: NotificationTargetContract): void;
  abstract dispatch(payload: NotificationEventPayloadContract): void;
}
