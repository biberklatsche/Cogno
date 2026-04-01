import {
  ApplicationFeatureCollectionContract,
  ApplicationSettingsExtensionContract,
  DatabaseMigrationContract,
  NotificationChannelContract,
  ShellDefinitionContract,
  ShellSupportDefinitionContract,
  SideMenuFeatureDefinitionContract,
  TerminalAutocompleteSuggestorDefinitionContract,
} from "@cogno/core-api";
import { PathFactory } from "./path/path.factory";
import { SideMenuFeatureRegistryHost } from "./side-menu-feature-registry.host";

export class CoreHostFeatureRegistryHost<
  TIcon = string,
  TActionName = string,
  TSideMenuFeatureExtension extends { id: string } = never,
> {
  private readonly databaseMigrations: DatabaseMigrationContract[] = [];
  private readonly notificationChannels: NotificationChannelContract[] = [];
  private readonly shellDefinitions: ShellDefinitionContract[] = [];
  private readonly shellSupportDefinitions: ShellSupportDefinitionContract[] = [];
  private readonly settingsExtensions: ApplicationSettingsExtensionContract[] = [];
  private readonly terminalAutocompleteSuggestorDefinitions: TerminalAutocompleteSuggestorDefinitionContract[] = [];

  constructor(
    private readonly sideMenuFeatureRegistryHost: SideMenuFeatureRegistryHost<
      TIcon,
      TActionName,
      TSideMenuFeatureExtension
    >,
  ) {}

  registerFeatureCollection(
    applicationFeatureCollection: ApplicationFeatureCollectionContract<TIcon, TActionName>,
  ): void {
    this.databaseMigrations.push(...applicationFeatureCollection.databaseMigrations);
    this.notificationChannels.push(...applicationFeatureCollection.notificationChannels);
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

  getNotificationChannels(): ReadonlyArray<NotificationChannelContract> {
    return this.notificationChannels;
  }

  getShellDefinitions(): ReadonlyArray<ShellDefinitionContract> {
    return this.shellDefinitions;
  }

  getShellSupportDefinitions(): ReadonlyArray<ShellSupportDefinitionContract> {
    return this.shellSupportDefinitions;
  }

  getSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinitionContract<TIcon, TActionName> | undefined {
    return this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitionById(sideMenuFeatureDefinitionId);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  > {
    return this.sideMenuFeatureRegistryHost.getSideMenuFeatureDefinitions();
  }

  registerSideMenuFeatureExtension(
    sideMenuFeatureExtension: TSideMenuFeatureExtension,
  ): void {
    this.sideMenuFeatureRegistryHost.registerSideMenuFeatureExtension(sideMenuFeatureExtension);
  }

  resolveSideMenuFeatureDefinitionById<TResolved>(
    sideMenuFeatureDefinitionId: string,
    resolveDefinition: (
      sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TIcon, TActionName>,
      sideMenuFeatureExtension: TSideMenuFeatureExtension | undefined,
    ) => TResolved,
  ): TResolved | undefined {
    return this.sideMenuFeatureRegistryHost.resolveSideMenuFeatureDefinitionById(
      sideMenuFeatureDefinitionId,
      resolveDefinition,
    );
  }

  resolveSideMenuFeatureDefinitions<TResolved>(
    resolveDefinition: (
      sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TIcon, TActionName>,
      sideMenuFeatureExtension: TSideMenuFeatureExtension | undefined,
    ) => TResolved,
  ): ReadonlyArray<TResolved> {
    return this.sideMenuFeatureRegistryHost.resolveSideMenuFeatureDefinitions(resolveDefinition);
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
