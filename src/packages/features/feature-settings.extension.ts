import type { ApplicationSettingsExtensionContract } from "@cogno/core-sdk";
import {
  FeatureCommandPaletteSchema,
  FeatureNotificationSchema,
  FeatureTerminalSchema,
  FeatureTerminalSearchSchema,
  FeatureWorkspaceSchema,
} from "./feature-settings.schemas";

const featureSettingsSchemaShape = {
  workspace: FeatureWorkspaceSchema.optional(),
  notification: FeatureNotificationSchema.optional(),
  command_palette: FeatureCommandPaletteSchema.optional(),
  terminal: FeatureTerminalSchema.optional(),
  terminal_search: FeatureTerminalSearchSchema.optional(),
} as const;

export const featureSettingsExtension = {
  defaults: {},
  schemaShape: featureSettingsSchemaShape,
  settingsSections: [
    { id: "workspace", title: "Workspace", order: 100 },
    { id: "notification", title: "Notifications", order: 200 },
    { id: "command_palette", title: "Command Palette", order: 300 },
    { id: "terminal", title: "Terminal", order: 400 },
    { id: "terminal_search", title: "Terminal Search", order: 500 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;
