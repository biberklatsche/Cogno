import { Injectable, Type } from "@angular/core";
import { CoreHostBootstrapHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "@cogno/ui-kit";
import { sideMenuFeatureDefinitions } from "../menu/side-menu/+state/side-menu-feature-definitions";
import { openFeatureDatabaseMigrations, openFeatureSideMenuFeatureDefinitions } from "@cogno/open-features";
import { proFeatureDatabaseMigrations, proFeatureSideMenuFeatureDefinitions } from "@cogno/pro-features";
import { DatabaseMigrationService } from "./database-migration.service";
import { coreDatabaseMigrations } from "./database-migrations";

@Injectable({ providedIn: "root" })
export class CoreHostWiringService {
  private readonly sideMenuFeatureRegistryHost = new SideMenuFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >();

  private readonly coreHostBootstrapHost = new CoreHostBootstrapHost<
    Type<unknown>,
    Icon,
    ActionName
  >(this.sideMenuFeatureRegistryHost);

  constructor(private readonly databaseMigrationService: DatabaseMigrationService) {
    this.coreHostBootstrapHost.registerSideMenuFeatures([
      ...sideMenuFeatureDefinitions,
      ...openFeatureSideMenuFeatureDefinitions,
      ...proFeatureSideMenuFeatureDefinitions,
    ]);
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations([
      ...openFeatureDatabaseMigrations,
      ...proFeatureDatabaseMigrations,
    ]);
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
    return this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitions();
  }
}
