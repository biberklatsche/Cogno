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
  defaults: {
    feature: {
      git: { mode: "on" },
      process_info: { mode: "on" },
      coding_agents: { mode: "on" },
    },
  },
  schemaShape: {
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
  },
  settingsSections: [
    { id: "feature.workspace", title: "Workspace", order: 100 },
    { id: "feature.notification_overview", title: "Notification Overview", order: 200 },
    { id: "feature.command_palette", title: "Command Palette", order: 400 },
    { id: "feature.search", title: "Search", order: 700 },
    { id: "feature.git", title: "Git", order: 900 },
    { id: "feature.process_info", title: "Process Info", order: 950 },
    { id: "feature.coding_agents", title: "Coding Agents", order: 1000 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;
