import { NotificationChannelContract } from "@cogno/shared/domain";
import { ApplicationSettingsExtensionContract } from "./application-settings-extension";
import { DatabaseMigrationContract } from "./database-migration";
import { ShellDefinitionContract } from "./shell-definition";
import { ShellPathAdapterDefinitionContract } from "./shell-path-adapter-definition";
import { ShellSupportDefinitionContract } from "./shell-support";
import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition";
import { TerminalAutocompleteSuggestorDefinitionContract } from "./terminal-autocomplete";

export interface ApplicationFeatureCollectionContract<TIcon = string, TActionName = string> {
  readonly databaseMigrations: ReadonlyArray<DatabaseMigrationContract>;
  readonly shellDefinitions: ReadonlyArray<ShellDefinitionContract>;
  readonly shellPathAdapterDefinitions: ReadonlyArray<ShellPathAdapterDefinitionContract>;
  readonly shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>;
  readonly sideMenuFeatureDefinitions: ReadonlyArray<
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  >;
  readonly notificationChannels: ReadonlyArray<NotificationChannelContract>;
  readonly settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract>;
  readonly terminalAutocompleteSuggestorDefinitions: ReadonlyArray<TerminalAutocompleteSuggestorDefinitionContract>;
}
