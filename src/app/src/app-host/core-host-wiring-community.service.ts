import { Injectable, Type } from "@angular/core";
import { CoreHostBootstrapHost, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import {
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "@cogno/ui-kit";
import { sideMenuFeatureDefinitions } from "../menu/side-menu/+state/side-menu-feature-definitions";
import {
  communityFeatureDatabaseMigrations,
  communityFeatureShellSupportDefinitions,
  communityFeatureSideMenuFeatureDefinitions,
  communityFeatureTerminalAutocompleteSuggestorDefinitions,
} from "@cogno/community-features";
import { DatabaseMigrationService } from "./database-migration.service";
import { coreDatabaseMigrations } from "./database-migrations";

@Injectable({ providedIn: "root" })
export class CoreHostWiringService {
  private readonly sideMenuFeatureRegistryHost = new SideMenuFeatureRegistryHost<
    Type<unknown>,
    Icon,
    ActionName
  >();
  private readonly terminalAutocompleteSuggestorDefinitions: ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  > = [...communityFeatureTerminalAutocompleteSuggestorDefinitions];
  private readonly shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract> = [
    ...communityFeatureShellSupportDefinitions,
  ];

  private readonly coreHostBootstrapHost = new CoreHostBootstrapHost<
    Type<unknown>,
    Icon,
    ActionName
  >(this.sideMenuFeatureRegistryHost);

  constructor(private readonly databaseMigrationService: DatabaseMigrationService) {
    this.coreHostBootstrapHost.registerSideMenuFeatures([
      ...sideMenuFeatureDefinitions,
      ...communityFeatureSideMenuFeatureDefinitions,
    ]);
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations([
      ...communityFeatureDatabaseMigrations,
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

  getTerminalAutocompleteSuggestorDefinitions(): ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  > {
    return this.terminalAutocompleteSuggestorDefinitions;
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return this.shellSupportDefinitions;
  }
}
