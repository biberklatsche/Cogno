import { Inject, Injectable } from "@angular/core";
import { CoreHostFeatureRegistryHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
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

@Injectable({ providedIn: "root" })
export class AppWiringService {
  private readonly sideMenuFeatureRegistryHost = new SideMenuFeatureRegistryHost<Icon, ActionName>();
  private readonly featureRegistryHost = new CoreHostFeatureRegistryHost<Icon, ActionName>(
    this.sideMenuFeatureRegistryHost,
  );
  private readonly sideMenuFeatureDefinitionsById = new Map<string, SideMenuFeatureDefinition>();

  constructor(
    private readonly applicationProduct: ApplicationProduct<Icon, ActionName>,
    @Inject(sideMenuFeatureDefinitionsToken)
    sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition>,
    private readonly appNotificationChannelService: AppNotificationChannelService,
    private readonly databaseMigrationService: DatabaseMigrationService,
    private readonly osNotificationChannelService: OsNotificationChannelService,
  ) {
    for (const sideMenuFeatureDefinition of sideMenuFeatureDefinitions) {
      this.sideMenuFeatureDefinitionsById.set(sideMenuFeatureDefinition.id, sideMenuFeatureDefinition);
    }

    this.featureRegistryHost.registerFeatureCollection({
      ...this.applicationProduct.featureCollection,
      sideMenuFeatureDefinitions: [
        ...sideMenuFeatureDefinitions.map(({ createLifecycle, targetComponent, ...definition }) => definition),
        ...this.applicationProduct.featureCollection.sideMenuFeatureDefinitions,
      ],
    });
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations(
      this.featureRegistryHost.getDatabaseMigrations(),
    );
  }

  getRequiredSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinition {
    const sideMenuFeatureDefinition = this.featureRegistryHost.getSideMenuFeatureDefinitionById(
      sideMenuFeatureDefinitionId,
    );
    if (sideMenuFeatureDefinition === undefined) {
      throw new Error(`Unknown side menu feature definition id: ${sideMenuFeatureDefinitionId}`);
    }
    return this.resolveSideMenuFeatureDefinition(sideMenuFeatureDefinition);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<SideMenuFeatureDefinition> {
    return this.featureRegistryHost
      .getSideMenuFeatureDefinitions()
      .map((sideMenuFeatureDefinition) => this.resolveSideMenuFeatureDefinition(sideMenuFeatureDefinition));
  }

  getSettingsExtensions(): ReadonlyArray<ApplicationSettingsExtensionContract> {
    return this.featureRegistryHost.getSettingsExtensions();
  }

  getNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    return [
      this.appNotificationChannelService,
      this.osNotificationChannelService,
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

  private resolveSideMenuFeatureDefinition(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<Icon, ActionName>,
  ): SideMenuFeatureDefinition {
    const uiDefinition = this.sideMenuFeatureDefinitionsById.get(sideMenuFeatureDefinition.id);
    if (uiDefinition === undefined) {
      throw new Error(`Missing side menu UI definition for feature id: ${sideMenuFeatureDefinition.id}`);
    }

    return {
      ...sideMenuFeatureDefinition,
      ...uiDefinition,
    };
  }
}
