import { InjectionToken } from "@angular/core";
import { ActionName } from "@cogno/app/action/action.models";
import { ApplicationFeatureCollectionContract } from "@cogno/shared/contributions";
import { NotificationChannelContract } from "@cogno/shared/domain";
import { Icon } from "@cogno/shared/ui";

export const additionalNotificationChannelsToken = new InjectionToken<
  ReadonlyArray<NotificationChannelContract>
>("additional-notification-channels-token");

/** Everything the features contribute to the application, provided by the bootstrap. */
export const featureCollectionToken = new InjectionToken<
  ApplicationFeatureCollectionContract<Icon, ActionName>
>("feature-collection-token");
