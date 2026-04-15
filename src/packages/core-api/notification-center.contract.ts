import { Observable } from "rxjs";
import { NotificationEventPayloadContract } from "./notification.contract";

export interface NotificationCenterPortContract {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  getOverviewMaxItems(): number;
}

export abstract class NotificationCenterPort implements NotificationCenterPortContract {
  abstract readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  abstract getOverviewMaxItems(): number;
}

export type NotificationCenterItemIdContract = number;

export interface NotificationCenterItemContract {
  readonly id: NotificationCenterItemIdContract;
  readonly header: string;
  readonly body?: string;
  readonly type: NonNullable<NotificationEventPayloadContract["type"]>;
  readonly count: number;
  readonly timestamp: Date;
}
