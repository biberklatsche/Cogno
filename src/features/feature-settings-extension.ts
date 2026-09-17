import {
  ApplicationSettingsExtensionContract,
  FeatureCodingAgentsSchema,
  FeatureCommandPaletteSchema,
  FeatureDefinition,
  FeatureGitSchema,
  FeatureNotificationOverviewSchema,
  FeatureProcessInfoSchema,
  FeatureSearchSchema,
  FeatureWorkspaceSchema,
} from "@cogno/shared/contributions";
import { z } from "zod";

const featureSettingsSchemaShape = {
  feature: z
    .object({
      workspace: FeatureWorkspaceSchema.optional(),
      notification_overview: FeatureNotificationOverviewSchema.optional(),
      command_palette: FeatureCommandPaletteSchema.optional(),
      search: FeatureSearchSchema.optional(),
      git: FeatureGitSchema.optional(),
      process_info: FeatureProcessInfoSchema.optional(),
      coding_agents: FeatureCodingAgentsSchema.optional(),
    })
    .optional(),
} as const;

export const defaultFeatureSettingsExtension = {
  schemaShape: featureSettingsSchemaShape,
} as const satisfies ApplicationSettingsExtensionContract;

/**
 * The configuration schema for every feature. Kept as one extension because a
 * top-level config key has exactly one owner, and all features share the
 * `feature` key.
 */
export const featureSettingsFeature: FeatureDefinition = {
  mode: "on",
  target: "workbench",
  id: "feature-settings",
  settings: defaultFeatureSettingsExtension,
};
