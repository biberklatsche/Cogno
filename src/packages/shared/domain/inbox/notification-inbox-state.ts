import {
  NotificationCenterItemContract,
  NotificationCenterItemIdContract,
} from "../notification-center-item";

export interface NotificationInboxState {
  readonly enabled: boolean;
  readonly notificationMap: Readonly<
    Record<NotificationCenterItemIdContract, NotificationCenterItemContract>
  >;
}
