import { Type } from "@angular/core";
import { ApplicationFeatureCollectionContract } from "@cogno/core-sdk";
import { featureTerminalAutocompleteSuggestorDefinitions } from "./autocomplete/terminal-autocomplete-suggestor-definitions";
import { featureDatabaseMigrations } from "./database-migrations";
import { featureSettingsExtension } from "./feature-settings.extension";
import {
  featureShellDefinitions,
  featureShellPathAdapterDefinitions,
  featureShellSupportDefinitions,
} from "./shell/shell-definitions";
import { featureSideMenuFeatureDefinitions } from "./side-menu/side-menu-feature-definitions";

export const featureApplicationFeatureCollection = {
  databaseMigrations: featureDatabaseMigrations,
  shellDefinitions: featureShellDefinitions,
  shellPathAdapterDefinitions: featureShellPathAdapterDefinitions,
  shellSupportDefinitions: featureShellSupportDefinitions,
  sideMenuFeatureDefinitions: featureSideMenuFeatureDefinitions,
  settingsExtensions: [featureSettingsExtension],
  terminalAutocompleteSuggestorDefinitions: featureTerminalAutocompleteSuggestorDefinitions,
} as const satisfies ApplicationFeatureCollectionContract<Type<unknown>, string, string>;
