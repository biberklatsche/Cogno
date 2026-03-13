import type {
  ApplicationSettingsExtensionContract,
  ApplicationSettingsSectionDefinitionContract,
} from "@cogno/core-sdk";
import { z, type ZodRawShape } from "zod";
import { baseConfigSchemaShape } from "./+models/config";

export interface ApplicationSettingsDefinition {
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly schema: z.ZodObject<ZodRawShape>;
  readonly settingsSections: ReadonlyArray<ApplicationSettingsSectionDefinitionContract>;
}

export function createApplicationSettingsDefinition(
  settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract> = [],
): ApplicationSettingsDefinition {
  const schemaShape: ZodRawShape = { ...baseConfigSchemaShape };
  const settingsSections: ApplicationSettingsSectionDefinitionContract[] = [];
  let defaults: Record<string, unknown> = {};

  for (const settingsExtension of settingsExtensions) {
    registerSettingsSchemaShape(schemaShape, settingsExtension.schemaShape);
    defaults = mergeSettingsObjects(defaults, settingsExtension.defaults);
    settingsSections.push(...settingsExtension.settingsSections);
  }

  return {
    defaults,
    schema: z.object(schemaShape).strict(),
    settingsSections,
  };
}

function registerSettingsSchemaShape(
  targetSchemaShape: ZodRawShape,
  extensionSchemaShape: ZodRawShape,
): void {
  const mutableTargetSchemaShape = targetSchemaShape as Record<string, ZodRawShape[string]>;
  for (const [settingsKey, settingsSchema] of Object.entries(extensionSchemaShape)) {
    if (settingsKey in targetSchemaShape) {
      throw new Error(`Duplicate settings schema key: ${settingsKey}`);
    }
    mutableTargetSchemaShape[settingsKey] = settingsSchema;
  }
}

function mergeSettingsObjects(
  baseSettings: Readonly<Record<string, unknown>>,
  overridingSettings: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const mergedSettings: Record<string, unknown> = { ...baseSettings };

  for (const [settingsKey, overridingValue] of Object.entries(overridingSettings)) {
    const baseValue = mergedSettings[settingsKey];
    mergedSettings[settingsKey] = mergeSettingsValue(baseValue, overridingValue);
  }

  return mergedSettings;
}

function mergeSettingsValue(baseValue: unknown, overridingValue: unknown): unknown {
  if (overridingValue === undefined) {
    return cloneSettingsValue(baseValue);
  }

  if (!isPlainObject(baseValue) || !isPlainObject(overridingValue)) {
    return cloneSettingsValue(overridingValue);
  }

  return mergeSettingsObjects(baseValue, overridingValue);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneSettingsValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}
