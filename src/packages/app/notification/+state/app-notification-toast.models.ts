import { NotificationTargetContract, NotificationTypeContract } from "@cogno/core-api";

export type AppNotificationToastId = number;

export interface AppNotificationToast {
  readonly id: AppNotificationToastId;
  readonly header: string;
  readonly body?: string;
  readonly target?: NotificationTargetContract;
  readonly type: NotificationTypeContract;
  readonly timestamp: Date;
}
