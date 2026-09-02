import { Injectable } from "@angular/core";
import { NotificationChannelsSource } from "@cogno/core/workbench/notification/notification-channels.source";
import { NotificationChannelContract } from "@cogno/shared/domain";
import { AppWiringService } from "./app-wiring.service";

/** Hands the workbench the notification channels the features contribute. */
@Injectable({ providedIn: "root" })
export class NotificationChannelsFeatureSourceService extends NotificationChannelsSource {
  constructor(private readonly wiringService: AppWiringService) {
    super();
  }

  getNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    return this.wiringService.getNotificationChannels();
  }
}
