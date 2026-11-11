import { NotificationTargetContract, NotificationTypeContract } from "@cogno/shared/domain";

export type AppNotificationToastId = number;

/**
 * `enter`: the round shape arrives. `open`: it has opened into the pill and
 * shows its text. `closing`: it shrinks back to the shape. `exit`: the shape
 * leaves.
 */
export type AppNotificationToastPhase = "enter" | "open" | "closing" | "exit";

export interface AppNotificationToast {
  readonly id: AppNotificationToastId;
  /**
   * The pill this notification is shown in. A notification that arrives while a
   * pill is on screen takes that pill over instead of opening a second one.
   */
  readonly pillId: AppNotificationToastId;
  readonly phase: AppNotificationToastPhase;
  /** When this notification got the pill, in epoch milliseconds. */
  readonly shownAt: number;
  readonly header: string;
  readonly body?: string;
  readonly target?: NotificationTargetContract;
  readonly type: NotificationTypeContract;
}
