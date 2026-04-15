import { NotificationCenterItemContract, NotificationCenterItemIdContract } from "@cogno/core-api";

export interface NotificationInboxState {
  readonly enabled: boolean;
  readonly notificationMap: Readonly<
    Record<NotificationCenterItemIdContract, NotificationCenterItemContract>
  >;
}
