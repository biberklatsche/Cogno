import { ApplicationSettingsExtensionContract } from "@cogno/core-api";
import { z } from "zod";
import {
  FeatureAiSchema,
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
      ai: FeatureAiSchema.optional(),
      git: FeatureGitSchema.optional(),
      coding_agents: FeatureCodingAgentsSchema.optional(),
    })
    .optional(),
} as const;

export const defaultFeatureSettingsExtension = {
  defaults: {
    feature: {
      ai: {
        mode: "visible",
        request: {
          include_process_tree: false,
          max_commands: 8,
          max_output_chars: 4000,
        },
      },
      git: {
        mode: "visible",
      },
      coding_agents: {
        mode: "visible",
      },
    },
  },
  schemaShape: featureSettingsSchemaShape,
  settingsSections: [
    { id: "feature.workspace", title: "Workspace", order: 100 },
    { id: "feature.notification_overview", title: "Notification Overview", order: 200 },
    { id: "feature.command_palette", title: "Command Palette", order: 400 },
    { id: "feature.search", title: "Search", order: 700 },
    { id: "feature.ai", title: "AI", order: 800 },
    { id: "feature.git", title: "Git", order: 900 },
    { id: "feature.coding_agents", title: "Coding Agents", order: 1000 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;
