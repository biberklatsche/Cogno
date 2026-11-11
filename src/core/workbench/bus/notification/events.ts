import { MessageBase } from "@cogno/core/workbench/bus/message-base";
import {
  NotificationChannelsContract,
  NotificationEventRefContract,
  NotificationTargetContract,
  NotificationTypeContract,
  TerminalId,
} from "@cogno/shared/domain";

type NotificationSource = string;
type NotificationChannels = NotificationChannelsContract;

export type NotificationEvent = MessageBase<
  "Notification",
  {
    readonly body?: string;
    readonly channels?: Partial<NotificationChannels>;
    readonly event?: NotificationEventRefContract;
    readonly header: string;
    readonly source?: NotificationSource;
    readonly terminalId?: TerminalId;
    readonly target?: NotificationTargetContract;
    readonly timestamp?: Date;
    readonly type?: NotificationTypeContract;
  }
>;
