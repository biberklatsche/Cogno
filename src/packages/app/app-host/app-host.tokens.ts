import { InjectionToken } from "@angular/core";
import { ActionName } from "@cogno/app/action/action.models";
import { ApplicationFeatureCollectionContract, NotificationChannelContract } from "@cogno/core-api";
import { Icon } from "@cogno/core-ui";

export const additionalNotificationChannelsToken = new InjectionToken<
  ReadonlyArray<NotificationChannelContract>
>("additional-notification-channels-token");

/** Everything the features contribute to the application, provided by the bootstrap. */
export const featureCollectionToken = new InjectionToken<
  ApplicationFeatureCollectionContract<Icon, ActionName>
>("feature-collection-token");
