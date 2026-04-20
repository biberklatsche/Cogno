import { ApplicationSettingsExtensionContract } from "./application-settings-extension.contract";
import {
  FeatureAutocompleteSchema,
  FeatureCommandPaletteSchema,
  FeatureNotificationSchema,
  FeatureNotificationsSchema,
  FeatureSearchSchema,
  FeatureTerminalSchema,
  FeatureWorkspaceSchema,
} from "./feature-settings.contract";

const featureSettingsSchemaShape = {
  workspace: FeatureWorkspaceSchema.optional(),
  notification: FeatureNotificationSchema.optional(),
  notifications: FeatureNotificationsSchema.optional(),
  command_palette: FeatureCommandPaletteSchema.optional(),
  terminal: FeatureTerminalSchema.optional(),
  autocomplete: FeatureAutocompleteSchema.optional(),
  search: FeatureSearchSchema.optional(),
} as const;

export const defaultFeatureSettingsExtension = {
  defaults: {
    notification: {
      exceptions: {
        handled: {
          enabled: false,
        },
        unhandled: {
          enabled: false,
        },
      },
    },
    autocomplete: {
      provider: {
        timeout_ms: 160,
      },
    },
  },
  schemaShape: featureSettingsSchemaShape,
  settingsSections: [
    { id: "workspace", title: "Workspace", order: 100 },
    { id: "notification", title: "Notification Center", order: 200 },
    { id: "notifications", title: "Notification Channels", order: 300 },
    { id: "command_palette", title: "Command Palette", order: 400 },
    { id: "terminal", title: "Terminal", order: 500 },
    { id: "autocomplete", title: "Autocomplete", order: 600 },
    { id: "search", title: "Search", order: 700 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;
