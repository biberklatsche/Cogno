import {
  ApplicationFeatureCollectionContract,
  ApplicationSettingsExtensionContract,
  DatabaseMigrationContract,
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-sdk";
import { PathFactory } from "./path/path.factory";
import { SideMenuFeatureRegistryHost } from "./side-menu-feature-registry.host";

export class CoreHostFeatureRegistryHost<
  TComponent = unknown,
  TIcon = string,
  TActionName = string,
> {
  private readonly databaseMigrations: DatabaseMigrationContract[] = [];
  private readonly shellDefinitions: ShellDefinitionContract[] = [];
  private readonly shellSupportDefinitions: ShellSupportDefinitionContract[] = [];
  private readonly settingsExtensions: ApplicationSettingsExtensionContract[] = [];
  private readonly terminalAutocompleteSuggestorDefinitions: TerminalAutocompleteSuggestorDefinitionContract[] = [];

  constructor(
    private readonly sideMenuFeatureRegistryHost: SideMenuFeatureRegistryHost<
      TComponent,
      TIcon,
      TActionName
    >,
  ) {}

  registerFeatureCollection(
    applicationFeatureCollection: ApplicationFeatureCollectionContract<TComponent, TIcon, TActionName>,
  ): void {
    this.databaseMigrations.push(...applicationFeatureCollection.databaseMigrations);
    this.shellDefinitions.push(...applicationFeatureCollection.shellDefinitions);
    this.shellSupportDefinitions.push(...applicationFeatureCollection.shellSupportDefinitions);
    this.settingsExtensions.push(...applicationFeatureCollection.settingsExtensions);
    this.terminalAutocompleteSuggestorDefinitions.push(
      ...applicationFeatureCollection.terminalAutocompleteSuggestorDefinitions,
    );

    PathFactory.registerDefinitions(applicationFeatureCollection.shellPathAdapterDefinitions);

    for (const sideMenuFeatureDefinition of applicationFeatureCollection.sideMenuFeatureDefinitions) {
      this.sideMenuFeatureRegistryHost.registerSideMenuFeature(sideMenuFeatureDefinition);
    }
  }

  getDatabaseMigrations(): ReadonlyArray<DatabaseMigrationContract> {
    return this.databaseMigrations;
  }

  getShellDefinitions(): ReadonlyArray<ShellDefinitionContract> {
    return this.shellDefinitions;
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return this.shellSupportDefinitions;
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  > {
    return this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitions();
  }

  getSettingsExtensions(): ReadonlyArray<ApplicationSettingsExtensionContract> {
    return this.settingsExtensions;
  }

  getTerminalAutocompleteSuggestorDefinitions(): ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  > {
    return this.terminalAutocompleteSuggestorDefinitions;
  }
}
