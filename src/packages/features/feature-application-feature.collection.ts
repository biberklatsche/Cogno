import { ApplicationFeatureCollectionContract } from "@cogno/core-api";
import { defaultFeatureSettingsExtension } from "./feature-settings-extension";
import { featureTerminalAutocompleteSuggestorDefinitions } from "./autocomplete/terminal-autocomplete-suggestor-definitions";
import { featureDatabaseMigrations } from "./database-migrations";
import {
  featureShellDefinitions,
  featureShellPathAdapterDefinitions,
  featureShellSupportDefinitions,
} from "./shell/shell-definitions";
import { featureSideMenuFeatureDefinitions } from "./side-menu/side-menu-feature-definitions";

export const featureApplicationFeatureCollection = {
  databaseMigrations: featureDatabaseMigrations,
  notificationChannels: [],
  shellDefinitions: featureShellDefinitions,
  shellPathAdapterDefinitions: featureShellPathAdapterDefinitions,
  shellSupportDefinitions: featureShellSupportDefinitions,
  sideMenuFeatureDefinitions: featureSideMenuFeatureDefinitions,
  settingsExtensions: [defaultFeatureSettingsExtension],
  terminalAutocompleteSuggestorDefinitions: featureTerminalAutocompleteSuggestorDefinitions,
} as const satisfies ApplicationFeatureCollectionContract<string, string>;
