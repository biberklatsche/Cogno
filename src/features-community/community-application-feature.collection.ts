import { Type } from "@angular/core";
import { ApplicationFeatureCollectionContract } from "@cogno/core-sdk";
import { communityFeatureTerminalAutocompleteSuggestorDefinitions } from "./autocomplete/community-terminal-autocomplete-suggestor-definitions";
import { communityFeatureDatabaseMigrations } from "./database-migrations";
import {
  communityFeatureShellDefinitions,
  communityFeatureShellPathAdapterDefinitions,
  communityFeatureShellSupportDefinitions,
} from "./shell/community-shell-definitions";
import { communityFeatureSideMenuFeatureDefinitions } from "./side-menu/side-menu-feature-definitions";

export const communityApplicationFeatureCollection = {
  databaseMigrations: communityFeatureDatabaseMigrations,
  shellDefinitions: communityFeatureShellDefinitions,
  shellPathAdapterDefinitions: communityFeatureShellPathAdapterDefinitions,
  shellSupportDefinitions: communityFeatureShellSupportDefinitions,
  sideMenuFeatureDefinitions: communityFeatureSideMenuFeatureDefinitions,
  terminalAutocompleteSuggestorDefinitions: communityFeatureTerminalAutocompleteSuggestorDefinitions,
} as const satisfies ApplicationFeatureCollectionContract<Type<unknown>, string, string>;
