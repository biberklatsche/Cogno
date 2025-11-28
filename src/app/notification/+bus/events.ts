import {MessageBase} from "../../app-bus/app-bus";

export type NotificationEvent = MessageBase<"Notification", {header: string, body: string}>
