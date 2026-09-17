import { ApplicationSettingsExtensionContract } from "@cogno/shared/contributions";
import { ZodRawShape, z } from "zod";
import { baseConfigSchemaShape } from "./models/config";

/**
 * The config schema: the core's own keys plus what the features contribute.
 * A key can have one owner only (the feature host reports a clash between two
 * features as a declaration conflict before this runs).
 */
export function createConfigSchema(
  settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract> = [],
): z.ZodObject<ZodRawShape> {
  const schemaShape: Record<string, ZodRawShape[string]> = { ...baseConfigSchemaShape };
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
