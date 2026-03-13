import { Injectable, type Type } from "@angular/core";
import { CoreHostFeatureRegistryHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import type {
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import type { ActionName } from "@cogno/workbench/action/action.models";
import { sideMenuFeatureDefinitions } from "@cogno/workbench/menu/side-menu/+state/side-menu-feature-definitions";
import { featureApplicationFeatureCollection } from "@cogno/features";
import type { Icon } from "@cogno/core-ui";
import { DatabaseMigrationService } from "@cogno/workbench/app-host/database-migration.service";
import { coreDatabaseMigrations } from "@cogno/workbench/app-host/database-migrations";

@Injectable({ providedIn: "root" })
export class AppWiringService {
  private readonly sideMenuFeatureRegistryHost = new SideMenuFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >();
  private readonly featureRegistryHost = new CoreHostFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >(this.sideMenuFeatureRegistryHost);

  constructor(private readonly databaseMigrationService: DatabaseMigrationService) {
    this.featureRegistryHost.registerFeatureCollection({
      ...featureApplicationFeatureCollection,
      sideMenuFeatureDefinitions: [
        ...sideMenuFeatureDefinitions,
        ...featureApplicationFeatureCollection.sideMenuFeatureDefinitions,
      ],
    });
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations(
      this.featureRegistryHost.getDatabaseMigrations(),
    );
  }

  getRequiredSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinitionContract<Type<unknown>, Icon, ActionName> {
    const sideMenuFeatureDefinition = this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitionById(
      sideMenuFeatureDefinitionId,
    );
    if (sideMenuFeatureDefinition === undefined) {
      throw new Error(`Unknown side menu feature definition id: ${sideMenuFeatureDefinitionId}`);
    }
    return sideMenuFeatureDefinition;
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<Type<unknown>, Icon, ActionName>
  > {
    return this.featureRegistryHost.getSideMenuFeatureDefinitions();
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
}
