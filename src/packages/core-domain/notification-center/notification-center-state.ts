import { NotificationCenterItemContract, NotificationCenterItemIdContract } from "@cogno/core-api";

export interface NotificationCenterState {
  readonly enabled: boolean;
  readonly notificationMap: Readonly<Record<NotificationCenterItemIdContract, NotificationCenterItemContract>>;
}
