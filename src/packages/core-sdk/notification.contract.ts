import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

export type NotificationTypeContract = "error" | "success" | "warning" | "info";

export interface NotificationChannelsContract {
  readonly app: boolean;
  readonly os: boolean;
  readonly telegram: boolean;
}

export interface NotificationEventPayloadContract {
  readonly header: string;
  readonly body?: string;
  readonly timestamp?: Date;
  readonly type?: NotificationTypeContract;
  readonly channels?: Partial<NotificationChannelsContract>;
}

export interface NotificationSettingsContract {
  readonly appEnabled: boolean;
  readonly osEnabled: boolean;
  readonly telegramEnabled: boolean;
  readonly appAvailable: boolean;
  readonly osAvailable: boolean;
  readonly telegramAvailable: boolean;
  readonly appNotificationDurationSeconds: number;
  readonly maxNotifications: number;
}

export interface NotificationHostPortContract {
  readonly notificationEvent$: Observable<NotificationEventPayloadContract>;
  readonly notificationSettings$: Observable<NotificationSettingsContract>;
  sendOsNotification(header: string, body?: string): Promise<void>;
}

export const notificationHostPortToken = new InjectionToken<NotificationHostPortContract>(
  "notification-host-port-token",
);
