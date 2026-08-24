import { ActionName } from "@cogno/app/action/action.models";
import { SideMenuFeatureDefinition } from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
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
import { Icon } from "@cogno/core-ui";
import { PathFactory } from "./path.factory";
import { SideMenuDefinitionRegistry } from "./side-menu-definition.registry";

type Definition = SideMenuFeatureDefinitionContract<Icon, ActionName>;

export class HostFeatureRegistry {
  private readonly databaseMigrations: DatabaseMigrationContract[] = [];
  private readonly notificationChannels: NotificationChannelContract[] = [];
  private readonly shellDefinitions: ShellDefinitionContract[] = [];
  private readonly shellSupportDefinitions: ShellSupportDefinitionContract[] = [];
  private readonly settingsExtensions: ApplicationSettingsExtensionContract[] = [];
  private readonly terminalAutocompleteSuggestorDefinitions: TerminalAutocompleteSuggestorDefinitionContract[] =
    [];

  constructor(private readonly sideMenuDefinitionRegistry: SideMenuDefinitionRegistry) {}

  registerFeatureCollection(
    applicationFeatureCollection: ApplicationFeatureCollectionContract<Icon, ActionName>,
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
      this.sideMenuDefinitionRegistry.registerSideMenuFeature(sideMenuFeatureDefinition);
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

  getSideMenuFeatureDefinitionById(id: string): Definition | undefined {
    return this.sideMenuDefinitionRegistry.getSideMenuFeatureDefinitionById(id);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<Definition> {
    return this.sideMenuDefinitionRegistry.getSideMenuFeatureDefinitions();
  }

  registerSideMenuFeatureExtension(ui: SideMenuFeatureDefinition): void {
    this.sideMenuDefinitionRegistry.registerSideMenuFeatureExtension(ui);
  }

  resolveSideMenuFeatureDefinitionById<TResolved>(
    id: string,
    resolve: (definition: Definition, ui: SideMenuFeatureDefinition | undefined) => TResolved,
  ): TResolved | undefined {
    return this.sideMenuDefinitionRegistry.resolveSideMenuFeatureDefinitionById(id, resolve);
  }

  resolveSideMenuFeatureDefinitions<TResolved>(
    resolve: (definition: Definition, ui: SideMenuFeatureDefinition | undefined) => TResolved,
  ): ReadonlyArray<TResolved> {
    return this.sideMenuDefinitionRegistry.resolveSideMenuFeatureDefinitions(resolve);
  }

  getSettingsExtensions(): ReadonlyArray<ApplicationSettingsExtensionContract> {
    return this.settingsExtensions;
  }

  getTerminalAutocompleteSuggestorDefinitions(): ReadonlyArray<TerminalAutocompleteSuggestorDefinitionContract> {
    return this.terminalAutocompleteSuggestorDefinitions;
  }
}
