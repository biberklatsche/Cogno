import { ActionBase } from "@cogno/core/workbench/bus/app-bus";
import { NotificationTargetContract } from "@cogno/shared/domain";

export type OpenNotificationTargetAction = ActionBase<
  "OpenNotificationTarget",
  NotificationTargetContract
>;
