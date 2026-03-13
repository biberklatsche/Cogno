import { Type } from "@angular/core";
import { ApplicationFeatureCollectionContract } from "@cogno/core-sdk";
import { baseFeatureTerminalAutocompleteSuggestorDefinitions } from "./autocomplete/base-terminal-autocomplete-suggestor-definitions";
import { baseFeatureDatabaseMigrations } from "./database-migrations";
import {
  baseFeatureShellDefinitions,
  baseFeatureShellPathAdapterDefinitions,
  baseFeatureShellSupportDefinitions,
} from "./shell/base-shell-definitions";
import { baseFeatureSideMenuFeatureDefinitions } from "./side-menu/side-menu-feature-definitions";

export const baseApplicationFeatureCollection = {
  databaseMigrations: baseFeatureDatabaseMigrations,
  shellDefinitions: baseFeatureShellDefinitions,
  shellPathAdapterDefinitions: baseFeatureShellPathAdapterDefinitions,
  shellSupportDefinitions: baseFeatureShellSupportDefinitions,
  sideMenuFeatureDefinitions: baseFeatureSideMenuFeatureDefinitions,
  terminalAutocompleteSuggestorDefinitions: baseFeatureTerminalAutocompleteSuggestorDefinitions,
} as const satisfies ApplicationFeatureCollectionContract<Type<unknown>, string, string>;
