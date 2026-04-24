import { NotificationTargetContract } from "@cogno/core-api";
import { ActionBase } from "../../app-bus/app-bus";

export type OpenNotificationTargetAction = ActionBase<
  "OpenNotificationTarget",
  NotificationTargetContract
>;
