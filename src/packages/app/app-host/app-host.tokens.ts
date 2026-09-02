import { InjectionToken } from "@angular/core";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { FeatureDefinition } from "@cogno/shared/contributions";
import { NotificationChannelContract } from "@cogno/shared/domain";

export const additionalNotificationChannelsToken = new InjectionToken<
  ReadonlyArray<NotificationChannelContract>
>("additional-notification-channels-token");

/** The features of the application, provided by the bootstrap from `app/features.ts`. */
export const featuresToken = new InjectionToken<ReadonlyArray<FeatureDefinition<ActionName>>>(
  "features-token",
);
