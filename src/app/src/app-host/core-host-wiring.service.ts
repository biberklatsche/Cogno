import { Injectable, Type } from "@angular/core";
import { CoreHostFeatureRegistryHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import {
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "@cogno/core-ui";
import { sideMenuFeatureDefinitions } from "../menu/side-menu/+state/side-menu-feature-definitions";
import { communityApplicationFeatureCollection } from "@cogno/community-features";
import { DatabaseMigrationService } from "./database-migration.service";
import { coreDatabaseMigrations } from "./database-migrations";

@Injectable({ providedIn: "root" })
export class CoreHostWiringService {
  private readonly sideMenuFeatureRegistryHost = new SideMenuFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >();
  private readonly coreHostFeatureRegistryHost = new CoreHostFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >(this.sideMenuFeatureRegistryHost);

  constructor(private readonly databaseMigrationService: DatabaseMigrationService) {
    this.coreHostFeatureRegistryHost.registerFeatureCollection({
      ...communityApplicationFeatureCollection,
      sideMenuFeatureDefinitions: [
        ...sideMenuFeatureDefinitions,
        ...communityApplicationFeatureCollection.sideMenuFeatureDefinitions,
      ],
    });
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations(
      this.coreHostFeatureRegistryHost.getDatabaseMigrations(),
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
    return this.coreHostFeatureRegistryHost.getSideMenuFeatureDefinitions();
  }

  getTerminalAutocompleteSuggestorDefinitions(): ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  > {
    return this.coreHostFeatureRegistryHost.getTerminalAutocompleteSuggestorDefinitions();
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return this.coreHostFeatureRegistryHost.getShellSupportDefinitions();
  }

  getShellDefinitions(): ReadonlyArray<ShellDefinitionContract> {
    return this.coreHostFeatureRegistryHost.getShellDefinitions();
  }
}
