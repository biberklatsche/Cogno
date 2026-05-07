import { InjectionToken } from "@angular/core";
import { NotificationChannelContract } from "@cogno/core-api";

export const additionalNotificationChannelsToken = new InjectionToken<
  ReadonlyArray<NotificationChannelContract>
>("additional-notification-channels-token");
