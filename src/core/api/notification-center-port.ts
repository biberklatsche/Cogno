import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export abstract class NotificationCenterPort {
  abstract readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  abstract openTarget(target: NotificationTargetContract): void;
  abstract dispatch(payload: NotificationEventPayloadContract): void;
}
