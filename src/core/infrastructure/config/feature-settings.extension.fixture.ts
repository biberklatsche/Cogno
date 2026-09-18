import {
  ApplicationSettingsExtensionContract,
  FeatureCodingAgentsSchema,
  FeatureCommandPaletteSchema,
  FeatureGitSchema,
  FeatureNotificationOverviewSchema,
  FeatureProcessInfoSchema,
  FeatureSearchSchema,
  FeatureWorkspaceSchema,
} from "@cogno/shared/contributions";
import { z } from "zod";

/**
 * A representative feature-settings extension for the ConfigMapper tests. It
 * mirrors the shape features contribute at runtime, but is owned by the core
 * test surface so the mapper's tests stay independent of the feature layer -
 * the mapper must not know the real feature set. The schemas themselves come
 * from shared/contributions, so there is a single schema definition.
 */
export const featureSettingsExtensionFixture = {
  schemaShape: {
    feature: z
      .strictObject({
        workspace: FeatureWorkspaceSchema.optional(),
        notification_overview: FeatureNotificationOverviewSchema.optional(),
        command_palette: FeatureCommandPaletteSchema.optional(),
        search: FeatureSearchSchema.optional(),
        git: FeatureGitSchema.optional(),
        process_info: FeatureProcessInfoSchema.optional(),
        coding_agents: FeatureCodingAgentsSchema.optional(),
      })
      .optional(),
  },
} as const satisfies ApplicationSettingsExtensionContract;
