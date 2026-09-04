import { Inject, Injectable } from "@angular/core";
import { shellDefinitions } from "@cogno/core/session/shells/shell-definitions";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppNotificationChannelService } from "@cogno/core/workbench/notification/+state/app-notification-channel.service";
import { OsNotificationChannelService } from "@cogno/core/workbench/notification/+state/os-notification-channel.service";
import { SideMenuFeatureDefinition } from "@cogno/core/workbench/side-menu/+state/side-menu-feature-definitions";
import {
  ApplicationSettingsExtensionContract,
  FeatureDefinition,
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
} from "@cogno/shared/contributions";
import { NotificationChannelContract } from "@cogno/shared/domain";
import { additionalNotificationChannelsToken, featuresToken } from "./app-host.tokens";

/**
 * Collects what the features contribute and hands each extension point to
 * its consumer. The feature list itself lives in `app/features.ts`; the
 * declaration-phase side effects (migrations, path adapters, whole-set
 * validation) belong to the feature-host now.
 */
@Injectable({ providedIn: "root" })
export class AppWiringService {
  private readonly sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition>;
  private readonly settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract>;
  private readonly featureNotificationChannels: ReadonlyArray<NotificationChannelContract>;

  constructor(
    @Inject(featuresToken) features: ReadonlyArray<FeatureDefinition<ActionName>>,
    @Inject(additionalNotificationChannelsToken)
    private readonly additionalNotificationChannels: ReadonlyArray<NotificationChannelContract>,
    private readonly appNotificationChannelService: AppNotificationChannelService,
    private readonly osNotificationChannelService: OsNotificationChannelService,
  ) {
    this.sideMenuFeatureDefinitions = [
      ...rejectDuplicateIds(
        features.flatMap((feature) => feature.sideMenu ?? []),
        (definition) => definition.id,
        "Side menu feature",
      ),
    ].sort((left, right) => left.order - right.order);
    this.settingsExtensions = features.flatMap((feature) =>
      feature.settings ? [feature.settings] : [],
    );
    this.featureNotificationChannels = features.flatMap(
      (feature) => feature.notificationChannels ?? [],
    );
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<SideMenuFeatureDefinition> {
    return this.sideMenuFeatureDefinitions;
  }

  getSettingsExtensions(): ReadonlyArray<ApplicationSettingsExtensionContract> {
    return this.settingsExtensions;
  }

  getNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    return [
      this.appNotificationChannelService,
      this.osNotificationChannelService,
      ...this.additionalNotificationChannels,
      ...this.featureNotificationChannels,
    ];
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return shellDefinitions.map((shell) => shell.support);
  }

  getShellDefinitions(): ReadonlyArray<ShellDefinitionContract> {
    return shellDefinitions;
  }
}

function rejectDuplicateIds<T>(
  items: ReadonlyArray<T>,
  idOf: (item: T) => string,
  label: string,
): ReadonlyArray<T> {
  const seen = new Set<string>();
  for (const item of items) {
    const id = idOf(item);
    if (seen.has(id)) {
      throw new Error(`${label} registered twice: ${id}`);
    }
    seen.add(id);
  }
  return items;
}
