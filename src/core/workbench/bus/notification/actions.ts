import { ActionBase } from "@cogno/core/workbench/bus/message-base";
import { NotificationTargetContract } from "@cogno/shared/domain";

export type OpenNotificationTargetAction = ActionBase<
  "OpenNotificationTarget",
  NotificationTargetContract
>;
