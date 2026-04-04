import { Inject, Injectable } from "@angular/core";
import { HostFeatureRegistry, SideMenuDefinitionRegistry } from "@cogno/core-host";
import {
  ApplicationProduct,
  ApplicationSettingsExtensionContract,
  NotificationChannelContract,
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-api";
import type { ActionName } from "@cogno/app/action/action.models";
import {
  sideMenuFeatureDefinitionsToken,
  type SideMenuFeatureDefinition,
} from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { AppNotificationChannelService } from "@cogno/app/notification/+state/app-notification-channel.service";
import { OsNotificationChannelService } from "@cogno/app/notification/+state/os-notification-channel.service";
import type { Icon } from "@cogno/core-ui";
import { DatabaseMigrationService } from "./database-migration.service";
import { coreDatabaseMigrations } from "./database-migrations";
import { additionalNotificationChannelsToken } from "./app-host.tokens";

@Injectable({ providedIn: "root" })
export class AppWiringService {
  private readonly featureRegistryHost = new HostFeatureRegistry<Icon, ActionName, SideMenuFeatureDefinition>(
    new SideMenuDefinitionRegistry<Icon, ActionName, SideMenuFeatureDefinition>(),
  );

  constructor(
    private readonly applicationProduct: ApplicationProduct<Icon, ActionName>,
    @Inject(sideMenuFeatureDefinitionsToken)
    sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition>,
    @Inject(additionalNotificationChannelsToken)
    private readonly additionalNotificationChannels: ReadonlyArray<NotificationChannelContract>,
    private readonly appNotificationChannelService: AppNotificationChannelService,
    private readonly databaseMigrationService: DatabaseMigrationService,
    private readonly osNotificationChannelService: OsNotificationChannelService,
  ) {
    for (const sideMenuFeatureDefinition of sideMenuFeatureDefinitions) {
      this.featureRegistryHost.registerSideMenuFeatureExtension(sideMenuFeatureDefinition);
    }

    this.featureRegistryHost.registerFeatureCollection(this.applicationProduct.featureCollection);
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations(
      this.featureRegistryHost.getDatabaseMigrations(),
    );
  }

  getRequiredSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinition {
    const sideMenuFeatureDefinition = this.featureRegistryHost.resolveSideMenuFeatureDefinitionById(
      sideMenuFeatureDefinitionId,
      (definition, extension) => this.mergeSideMenuFeatureDefinition(definition, extension),
    );
    if (sideMenuFeatureDefinition === undefined) {
      throw new Error(`Unknown side menu feature definition id: ${sideMenuFeatureDefinitionId}`);
    }
    return sideMenuFeatureDefinition;
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<SideMenuFeatureDefinition> {
    return this.featureRegistryHost
      .resolveSideMenuFeatureDefinitions((definition, extension) =>
        this.mergeSideMenuFeatureDefinition(definition, extension),
      );
  }

  getSettingsExtensions(): ReadonlyArray<ApplicationSettingsExtensionContract> {
    return this.featureRegistryHost.getSettingsExtensions();
  }

  getNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    return [
      this.appNotificationChannelService,
      this.osNotificationChannelService,
      ...this.additionalNotificationChannels,
      ...this.featureRegistryHost.getNotificationChannels(),
    ];
  }

  getTerminalAutocompleteSuggestorDefinitions(): ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  > {
    return this.featureRegistryHost.getTerminalAutocompleteSuggestorDefinitions();
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return this.featureRegistryHost.getShellSupportDefinitions();
  }

  getShellDefinitions(): ReadonlyArray<ShellDefinitionContract> {
    return this.featureRegistryHost.getShellDefinitions();
  }

  private mergeSideMenuFeatureDefinition(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<Icon, ActionName>,
    uiDefinition: SideMenuFeatureDefinition | undefined,
  ): SideMenuFeatureDefinition {
    if (uiDefinition === undefined) {
      throw new Error(`Missing side menu UI definition for feature id: ${sideMenuFeatureDefinition.id}`);
    }

    return {
      ...sideMenuFeatureDefinition,
      ...uiDefinition,
    };
  }
}
