import { ApplicationSettingsExtensionContract } from "./application-settings-extension.contract";
import {
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
  },
  schemaShape: featureSettingsSchemaShape,
  settingsSections: [
    { id: "workspace", title: "Workspace", order: 100 },
    { id: "notification", title: "Notification Center", order: 200 },
    { id: "notifications", title: "Notification Channels", order: 300 },
    { id: "command_palette", title: "Command Palette", order: 400 },
    { id: "terminal", title: "Terminal", order: 500 },
    { id: "search", title: "Search", order: 600 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;


