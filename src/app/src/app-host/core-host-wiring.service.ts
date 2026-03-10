import { Injectable, Type } from "@angular/core";
import { CoreHostBootstrapHost, PathFactory, SideMenuFeatureRegistryHost } from "@cogno/core-host";
import {
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "@cogno/core-ui";
import { sideMenuFeatureDefinitions } from "../menu/side-menu/+state/side-menu-feature-definitions";
import {
  communityFeatureShellPathAdapterDefinitions,
  communityFeatureDatabaseMigrations,
  communityFeatureShellSupportDefinitions,
  communityFeatureSideMenuFeatureDefinitions,
  communityFeatureTerminalAutocompleteSuggestorDefinitions,
} from "@cogno/community-features";
import {
  proFeatureDatabaseMigrations,
  proFeatureShellPathAdapterDefinitions,
  proFeatureShellSupportDefinitions,
  proFeatureSideMenuFeatureDefinitions,
  proFeatureTerminalAutocompleteSuggestorDefinitions,
} from "@cogno/pro-features";
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
  > = [
    ...communityFeatureTerminalAutocompleteSuggestorDefinitions,
    ...proFeatureTerminalAutocompleteSuggestorDefinitions,
  ];
  private readonly shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract> = [
    ...communityFeatureShellSupportDefinitions,
    ...proFeatureShellSupportDefinitions,
  ];

  private readonly coreHostBootstrapHost = new CoreHostBootstrapHost<
    Type<unknown>,
    Icon,
    ActionName
  >(this.sideMenuFeatureRegistryHost);

  constructor(private readonly databaseMigrationService: DatabaseMigrationService) {
    PathFactory.setDefinitions([
      ...communityFeatureShellPathAdapterDefinitions,
      ...proFeatureShellPathAdapterDefinitions,
    ]);
    this.coreHostBootstrapHost.registerSideMenuFeatures([
      ...sideMenuFeatureDefinitions,
      ...communityFeatureSideMenuFeatureDefinitions,
      ...proFeatureSideMenuFeatureDefinitions,
    ]);
    this.databaseMigrationService.registerCoreMigrations(coreDatabaseMigrations);
    this.databaseMigrationService.registerFeatureMigrations([
      ...communityFeatureDatabaseMigrations,
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

  getTerminalAutocompleteSuggestorDefinitions(): ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  > {
    return this.terminalAutocompleteSuggestorDefinitions;
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return this.shellSupportDefinitions;
  }
}
