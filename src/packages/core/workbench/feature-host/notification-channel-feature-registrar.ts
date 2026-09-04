import { Injectable } from "@angular/core";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { NotificationChannelRegistry } from "@cogno/core/workbench/notification/+state/notification-channel-registry";
import { FeatureDefinition } from "@cogno/shared/contributions";
import { FeatureContributionRegistrar } from "./feature-reconciler";

/**
 * The notification-channel contribution as the reconciler sees it: activating a
 * feature adds its channels to the registry, deactivating removes them.
 */
@Injectable({ providedIn: "root" })
export class NotificationChannelFeatureRegistrar implements FeatureContributionRegistrar {
  constructor(private readonly notificationChannelRegistry: NotificationChannelRegistry) {}

  register(feature: FeatureDefinition<ActionName>): void {
    for (const channel of feature.notificationChannels ?? []) {
      this.notificationChannelRegistry.register(channel);
    }
  }

  unregister(feature: FeatureDefinition<ActionName>): void {
    for (const channel of feature.notificationChannels ?? []) {
      this.notificationChannelRegistry.unregister(channel.id);
    }
  }
}
