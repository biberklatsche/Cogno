import {
  ApplicationSettingsExtensionContract,
  NotificationSourceContract,
} from "@cogno/core/api/contributions";
import { ZodRawShape, z } from "zod";
import { baseConfigSchemaShape } from "./models/config";
import { createNotificationSettingsSchema } from "./models/notification-settings";

/**
 * The config schema: the core's own keys plus what the features contribute.
 * A key can have one owner only (the feature host reports a clash between two
 * features as a declaration conflict before this runs). `notification.source`
 * is composed from the declared sources, core's and the features' alike.
 */
export function createConfigSchema(
  settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract> = [],
  notificationSources: ReadonlyArray<NotificationSourceContract> = [],
): z.ZodObject<ZodRawShape> {
  const schemaShape: Record<string, ZodRawShape[string]> = {
    ...baseConfigSchemaShape,
    notification: createNotificationSettingsSchema(notificationSources)
      .optional()
      .describe(baseConfigSchemaShape.notification.description ?? ""),
  };
  for (const settingsExtension of settingsExtensions) {
    for (const [settingsKey, settingsSchema] of Object.entries(settingsExtension.schemaShape)) {
      if (settingsKey in schemaShape) {
        throw new Error(`Duplicate settings schema key: ${settingsKey}`);
      }
      schemaShape[settingsKey] = settingsSchema;
    }
  }
  return z.object(schemaShape).strict();
}
