import {
  NotificationChannelsContract,
  NotificationTargetContract,
  NotificationTypeContract,
  TerminalId,
} from "@cogno/core-api";
import { MessageBase } from "../../app-bus/app-bus";

export type NotificationSource = string;
export type NotificationChannels = NotificationChannelsContract;

export type NotificationEvent = MessageBase<
  "Notification",
  {
    readonly body?: string;
    readonly channels?: Partial<NotificationChannels>;
    readonly header: string;
    readonly source?: NotificationSource;
    readonly terminalId?: TerminalId;
    readonly target?: NotificationTargetContract;
    readonly timestamp?: Date;
    readonly type?: NotificationTypeContract;
  }
>;
