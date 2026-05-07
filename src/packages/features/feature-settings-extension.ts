import { ApplicationSettingsExtensionContract } from "@cogno/core-api";
import {
  FeatureAiSchema,
  FeatureAutocompleteSchema,
  FeatureCommandPaletteSchema,
  FeatureNotificationSchema,
  FeatureNotificationsSchema,
  FeatureSearchSchema,
  FeatureTerminalSchema,
  FeatureWorkspaceSchema,
} from "./feature-settings.schemas";

const featureSettingsSchemaShape = {
  workspace: FeatureWorkspaceSchema.optional(),
  notification: FeatureNotificationSchema.optional(),
  notifications: FeatureNotificationsSchema.optional(),
  command_palette: FeatureCommandPaletteSchema.optional(),
  terminal: FeatureTerminalSchema.optional(),
  autocomplete: FeatureAutocompleteSchema.optional(),
  search: FeatureSearchSchema.optional(),
  ai: FeatureAiSchema.optional(),
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
    ai: {
      mode: "off",
      active_provider: "",
      providers: {
        default: {
          type: "openai_compatible",
          base_url: "",
          model: "",
          api_key: "",
          enabled: false,
        },
      },
      request: {
        include_process_tree: false,
        max_commands: 8,
        max_output_chars: 4000,
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
    { id: "ai", title: "AI", order: 800 },
  ],
} as const satisfies ApplicationSettingsExtensionContract;
