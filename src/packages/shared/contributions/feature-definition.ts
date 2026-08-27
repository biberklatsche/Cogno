import { NotificationChannelContract } from "@cogno/shared/domain";
import { ApplicationSettingsExtensionContract } from "./application-settings-extension";
import { DatabaseMigrationContract } from "./database-migration";
import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition";
import { TerminalAutocompleteSuggestorDefinitionContract } from "./terminal-autocomplete";

/**
 * Everything a feature contributes to the application. One optional field
 * per extension point; the app collects the definitions listed in
 * `app/features.ts` and wires each field to its consumer.
 */
export interface FeatureDefinition<TActionName = string> {
  readonly id: string;
  /** Schema steps, applied on startup in list order. */
  readonly migrations?: ReadonlyArray<DatabaseMigrationContract>;
  /** Side-menu entries with panel component and lifecycle. */
  readonly sideMenu?: ReadonlyArray<SideMenuFeatureDefinitionContract<TActionName>>;
  /** Zod schema extension and defaults for the configuration reader. */
  readonly settings?: ApplicationSettingsExtensionContract;
  /** Suggestors for the terminal autocomplete. */
  readonly autocompleteSuggestors?: ReadonlyArray<TerminalAutocompleteSuggestorDefinitionContract>;
  /** Additional notification channels. */
  readonly notificationChannels?: ReadonlyArray<NotificationChannelContract>;
}
