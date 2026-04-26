import { Observable } from "rxjs";
import {
  NotificationEventPayloadContract,
  NotificationTargetContract,
} from "./notification.contract";

export interface NotificationCenterPortContract {
  readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  getOverviewMaxItems(): number;
  openTarget(target: NotificationTargetContract): void;
}

export abstract class NotificationCenterPort implements NotificationCenterPortContract {
  abstract readonly notificationEvents$: Observable<NotificationEventPayloadContract>;
  abstract getOverviewMaxItems(): number;
  abstract openTarget(target: NotificationTargetContract): void;
}

export type NotificationCenterItemIdContract = number;

export interface NotificationCenterItemContract {
  readonly id: NotificationCenterItemIdContract;
  readonly header: string;
  readonly body?: string;
  readonly target?: NotificationTargetContract;
  readonly type: NonNullable<NotificationEventPayloadContract["type"]>;
  readonly count: number;
  readonly timestamp: Date;
}
