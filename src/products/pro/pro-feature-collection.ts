import { communityFeatureCollection } from "../community/community-feature-collection";

const proAdditionalDatabaseMigrations = [] as const;
const proAdditionalNotificationChannels = [] as const;
const proAdditionalShellDefinitions = [] as const;
const proAdditionalShellPathAdapterDefinitions = [] as const;
const proAdditionalShellSupportDefinitions = [] as const;
const proAdditionalSideMenuFeatureDefinitions = [] as const;
const proAdditionalSettingsExtensions = [] as const;
const proAdditionalTerminalAutocompleteSuggestorDefinitions = [] as const;

export const proFeatureCollection = {
  ...communityFeatureCollection,
  databaseMigrations: [
    ...communityFeatureCollection.databaseMigrations,
    ...proAdditionalDatabaseMigrations,
  ],
  notificationChannels: [
    ...communityFeatureCollection.notificationChannels,
    ...proAdditionalNotificationChannels,
  ],
  shellDefinitions: [
    ...communityFeatureCollection.shellDefinitions,
    ...proAdditionalShellDefinitions,
  ],
  shellPathAdapterDefinitions: [
    ...communityFeatureCollection.shellPathAdapterDefinitions,
    ...proAdditionalShellPathAdapterDefinitions,
  ],
  shellSupportDefinitions: [
    ...communityFeatureCollection.shellSupportDefinitions,
    ...proAdditionalShellSupportDefinitions,
  ],
  sideMenuFeatureDefinitions: [
    ...communityFeatureCollection.sideMenuFeatureDefinitions,
    ...proAdditionalSideMenuFeatureDefinitions,
  ],
  settingsExtensions: [
    ...communityFeatureCollection.settingsExtensions,
    ...proAdditionalSettingsExtensions,
  ],
  terminalAutocompleteSuggestorDefinitions: [
    ...communityFeatureCollection.terminalAutocompleteSuggestorDefinitions,
    ...proAdditionalTerminalAutocompleteSuggestorDefinitions,
  ],
} as const;
