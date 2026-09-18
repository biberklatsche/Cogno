import { NotificationEventPayloadContract, NotificationTargetContract } from "./notification";

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
