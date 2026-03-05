import {MessageBase} from "../../app-bus/app-bus";
import {NotificationType} from "../+state/notification.service";
import {TerminalId} from "../../grid-list/+model/model";

export type NotificationSource = 'local' | 'telegram';

export type NotificationEvent = MessageBase<"Notification", {
    header: string;
    body?: string;
    timestamp?: Date;
    type?: NotificationType;
    source?: NotificationSource;
    terminalId?: TerminalId;
}>
