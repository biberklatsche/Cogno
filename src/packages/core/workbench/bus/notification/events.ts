import { MessageBase } from "@cogno/core/workbench/bus/app-bus";
import {
  NotificationChannelsContract,
  NotificationTargetContract,
  NotificationTypeContract,
  TerminalId,
} from "@cogno/shared/domain";

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
