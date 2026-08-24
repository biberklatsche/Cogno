import { NotificationTargetContract } from "@cogno/shared/domain";
import { ActionBase } from "../../app-bus/app-bus";

export type OpenNotificationTargetAction = ActionBase<
  "OpenNotificationTarget",
  NotificationTargetContract
>;
