import { NotificationEventPayloadContract, NotificationTargetContract } from "@cogno/shared/domain";

/** The notification's text and target; the same notification again is the same entry. */
export type NotificationCenterItemIdContract = string;

export interface NotificationCenterItemContract {
  readonly id: NotificationCenterItemIdContract;
  readonly header: string;
  readonly body?: string;
  readonly target?: NotificationTargetContract;
  readonly type: NonNullable<NotificationEventPayloadContract["type"]>;
  readonly count: number;
  readonly timestamp: Date;
}
