import {MessageBase} from "../../app-bus/app-bus";
import {NotificationTypeContract} from "@cogno/core-sdk";
import {TerminalId} from "../../grid-list/+model/model";

export type NotificationSource = 'local' | 'telegram';
export type NotificationChannels = {
    app: boolean;
    os: boolean;
    telegram: boolean;
};

export type NotificationEvent = MessageBase<"Notification", {
    header: string;
    body?: string;
    timestamp?: Date;
    type?: NotificationTypeContract;
    source?: NotificationSource;
    terminalId?: TerminalId;
    channels?: Partial<NotificationChannels>;
}>
