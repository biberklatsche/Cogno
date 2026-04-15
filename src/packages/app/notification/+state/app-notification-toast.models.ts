import { NotificationTypeContract } from "@cogno/core-api";

export type AppNotificationToastId = number;

export interface AppNotificationToast {
  readonly id: AppNotificationToastId;
  readonly header: string;
  readonly body?: string;
  readonly type: NotificationTypeContract;
  readonly timestamp: Date;
}
