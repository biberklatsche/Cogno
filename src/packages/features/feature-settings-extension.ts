import {
  ApplicationSettingsExtensionContract,
  FeatureDefinition,
} from "@cogno/shared/contributions";
import { z } from "zod";
import {
  FeatureCodingAgentsSchema,
  FeatureCommandPaletteSchema,
  FeatureGitSchema,
  FeatureNotificationOverviewSchema,
  FeatureSearchSchema,
  FeatureWorkspaceSchema,
} from "./feature-settings.schemas";

const featureSettingsSchemaShape = {
  feature: z
    .object({
      workspace: FeatureWorkspaceSchema.optional(),
      notification_overview: FeatureNotificationOverviewSchema.optional(),
      command_palette: FeatureCommandPaletteSchema.optional(),
      search: FeatureSearchSchema.optional(),
      git: FeatureGitSchema.optional(),
      coding_agents: FeatureCodingAgentsSchema.optional(),
    })
    .optional(),
} as const;

export const defaultFeatureSettingsExtension = {
  defaults: {
    feature: {
      git: {
        mode: "on",
      },
      coding_agents: {
        mode: "on",
      },
    },
  },
  schemaShape: featureSettingsSchemaShape,
  settingsSections: [
    { id: "feature.workspace", title: "Workspace", order: 100 },
    { id: "feature.notification_overview", title: "Notification Overview", order: 200 },
    { id: "feature.command_palette", title: "Command Palette", order: 400 },
    { id: "feature.search", title: "Search", order: 700 },
    { id: "feature.git", title: "Git", order: 900 },
    { id: "feature.coding_agents", title: "Coding Agents", order: 1000 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;

/**
 * The configuration schema for every feature. Kept as one extension because
 * the reader merges extensions by top-level key, and all features share the
 * `feature` key.
 */
export const featureSettingsFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: "feature-settings",
  settings: defaultFeatureSettingsExtension,
};
