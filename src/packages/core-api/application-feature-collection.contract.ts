import { ApplicationSettingsExtensionContract } from "./application-settings-extension.contract";
import { DatabaseMigrationContract } from "./database-migration.contract";
import { NotificationChannelContract } from "./notification.contract";
import { ShellDefinitionContract } from "./shell-definition.contract";
import { ShellPathAdapterDefinitionContract } from "./shell-path-adapter-definition.contract";
import { ShellSupportDefinitionContract } from "./shell-support.contract";
import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition.contract";
import { TerminalAutocompleteSuggestorDefinitionContract } from "./terminal-autocomplete.contract";

export interface ApplicationFeatureCollectionContract<
  TIcon = string,
  TActionName = string,
> {
  readonly databaseMigrations: ReadonlyArray<DatabaseMigrationContract>;
  readonly shellDefinitions: ReadonlyArray<ShellDefinitionContract>;
  readonly shellPathAdapterDefinitions: ReadonlyArray<ShellPathAdapterDefinitionContract>;
  readonly shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>;
  readonly sideMenuFeatureDefinitions: ReadonlyArray<
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  >;
  readonly notificationChannels: ReadonlyArray<NotificationChannelContract>;
  readonly settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract>;
  readonly terminalAutocompleteSuggestorDefinitions: ReadonlyArray<
    TerminalAutocompleteSuggestorDefinitionContract
  >;
}
