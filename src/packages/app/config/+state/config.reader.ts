import { OS, OsType } from "@cogno/app-tauri/os";
import {
  ApplicationSettingsExtensionContract,
  defaultFeatureSettingsExtension,
} from "@cogno/core-api";
import { z } from "zod";
import { Config } from "../+models/config";
import {
  ApplicationSettingsDefinition,
  createApplicationSettingsDefinition,
} from "../application-settings-definition";

export type ConfigDiagnostic = {
  level: "warning" | "error";
  message: string;
};

export class ConfigReader {
  static fromStringToConfig(
    defaultConfigString: string,
    userConfigString: string,
    settingsExtensions?: ReadonlyArray<ApplicationSettingsExtensionContract>,
  ): Config;
  static fromStringToConfig(
    userConfigStringOnly: string,
    settingsExtensions?: ReadonlyArray<ApplicationSettingsExtensionContract>,
  ): Config;
  static fromStringToConfig(
    firstArgument: string,
    secondArgument?: string | ReadonlyArray<ApplicationSettingsExtensionContract>,
    thirdArgument: ReadonlyArray<ApplicationSettingsExtensionContract> = [],
  ): Config {
    const defaultConfigString = typeof secondArgument === "string" ? firstArgument : "";
    const userConfigString = typeof secondArgument === "string" ? secondArgument : firstArgument;
    const settingsExtensions = resolveSettingsExtensions(
      Array.isArray(secondArgument) ? secondArgument : thirdArgument,
    );
    const applicationSettingsDefinition = createApplicationSettingsDefinition(settingsExtensions);
    const userConfig = ConfigReader.parseConfigString(
      userConfigString || "",
      applicationSettingsDefinition.schema,
    );
    const defaultConfig = ConfigReader.parseConfigString(
      defaultConfigString || "",
      applicationSettingsDefinition.schema,
    );
    return ConfigReader.toConfigWithDiagnostics(
      defaultConfig,
      userConfig,
      applicationSettingsDefinition,
    ).config;
  }

  static fromStringToConfigWithDiagnostics(
    defaultConfigString: string,
    userConfigString: string,
    settingsExtensions?: ReadonlyArray<ApplicationSettingsExtensionContract>,
  ): { config: Config; diagnostics: ConfigDiagnostic[] };
  static fromStringToConfigWithDiagnostics(
    userConfigStringOnly: string,
    settingsExtensions?: ReadonlyArray<ApplicationSettingsExtensionContract>,
  ): { config: Config; diagnostics: ConfigDiagnostic[] };
  static fromStringToConfigWithDiagnostics(
    firstArgument: string,
    secondArgument?: string | ReadonlyArray<ApplicationSettingsExtensionContract>,
    thirdArgument: ReadonlyArray<ApplicationSettingsExtensionContract> = [],
  ): { config: Config; diagnostics: ConfigDiagnostic[] } {
    const defaultConfigString = typeof secondArgument === "string" ? firstArgument : "";
    const userConfigString = typeof secondArgument === "string" ? secondArgument : firstArgument;
    const settingsExtensions = resolveSettingsExtensions(
      Array.isArray(secondArgument) ? secondArgument : thirdArgument,
    );
    const applicationSettingsDefinition = createApplicationSettingsDefinition(settingsExtensions);
    const userConfig = ConfigReader.parseConfigString(
      userConfigString || "",
      applicationSettingsDefinition.schema,
    );
    const defaultConfig = ConfigReader.parseConfigString(
      defaultConfigString || "",
      applicationSettingsDefinition.schema,
    );
    return ConfigReader.toConfigWithDiagnostics(
      defaultConfig,
      userConfig,
      applicationSettingsDefinition,
    );
  }

  private static toConfigWithDiagnostics(
    defaultConfig: Record<string, unknown>,
    userConfig: Record<string, unknown>,
    applicationSettingsDefinition: ApplicationSettingsDefinition,
  ): { config: Config; diagnostics: ConfigDiagnostic[] } {
    const defaultConfigWithExtensions = mergeConfigObjects(
      defaultConfig ?? {},
      applicationSettingsDefinition.defaults,
    );
    const mergedConfig = ConfigReader.mergeConfigValues(
      defaultConfigWithExtensions,
      userConfig ?? {},
    ) as Record<string, unknown>;
    const diagnostics: ConfigDiagnostic[] = [];
    const initialCandidate = ConfigReader.clone(mergedConfig);
    let candidate: Record<string, unknown> = initialCandidate === undefined ? {} : initialCandidate;

    for (let attempt = 0; attempt < 10; attempt++) {
      const result = applicationSettingsDefinition.schema.safeParse(candidate);
      if (result.success) {
        const config = result.data as Config;
        if (config.font?.family) {
          config.font.family = ConfigReader.addFontFallbacks(config.font.family);
        }
        return { config, diagnostics };
      }
      const changed = ConfigReader.applyDiagnosticsAndStrip(
        candidate,
        defaultConfigWithExtensions,
        result.error,
        diagnostics,
      );
      if (!changed) {
        break;
      }
      const clonedCandidate = ConfigReader.clone(candidate);
      candidate = clonedCandidate === undefined ? {} : clonedCandidate;
    }

    const fallbackResult = applicationSettingsDefinition.schema.safeParse(
      defaultConfigWithExtensions,
    );
    const emptyResult = fallbackResult.success
      ? fallbackResult
      : applicationSettingsDefinition.schema.safeParse({});
    const fallback = (emptyResult.success ? emptyResult.data : {}) as Config;
    if (fallback.font?.family) {
      fallback.font.family = ConfigReader.addFontFallbacks(fallback.font.family);
    }
    diagnostics.push({
      level: "error",
      message: "Invalid configuration entries were ignored. Defaults were used where needed.",
    });
    return { config: fallback, diagnostics };
  }

  private static mergeConfigValues(defaultValue: unknown, userValue: unknown): unknown {
    if (userValue === undefined) {
      return ConfigReader.clone(defaultValue);
    }
    if (Array.isArray(userValue)) {
      return userValue;
    }
    if (Array.isArray(defaultValue)) {
      return userValue;
    }
    if (!ConfigReader.isPlainObject(userValue) || !ConfigReader.isPlainObject(defaultValue)) {
      return userValue;
    }

    const mergedConfig: Record<string, unknown> = {};
    const configKeys = new Set<string>([
      ...Object.keys(defaultValue || {}),
      ...Object.keys(userValue || {}),
    ]);

    for (const configKey of configKeys) {
      if (configKey === "keybind") {
        const defaultKeybindValue = defaultValue[configKey];
        const userKeybindValue = userValue[configKey];
        const defaultKeybindEntries = Array.isArray(defaultKeybindValue)
          ? defaultKeybindValue
          : defaultKeybindValue === undefined
            ? []
            : [defaultKeybindValue];
        const userKeybindEntries = Array.isArray(userKeybindValue)
          ? userKeybindValue
          : userKeybindValue === undefined
            ? []
            : [userKeybindValue];
        mergedConfig[configKey] = [...defaultKeybindEntries, ...userKeybindEntries];
        continue;
      }

      mergedConfig[configKey] = ConfigReader.mergeConfigValues(
        defaultValue[configKey],
        userValue[configKey],
      );
    }

    return mergedConfig;
  }

  private static addFontFallbacks(fontFamily: string): string {
    const platform = OS.platform();
    const fallbacks = ConfigReader.getPlatformFontFallbacks(platform);
    const cleanedFontFamily = ConfigReader.quoteFontName(fontFamily);
    const genericFonts = ["monospace", "sans-serif", "serif", "cursive", "fantasy"];
    if (genericFonts.includes(cleanedFontFamily.toLowerCase())) {
      return fallbacks;
    }
    return `${cleanedFontFamily}, ${fallbacks}`;
  }

  private static quoteFontName(fontName: string): string {
    let cleanedFontName = fontName.trim();
    if (
      (cleanedFontName.startsWith('"') && cleanedFontName.endsWith('"')) ||
      (cleanedFontName.startsWith("'") && cleanedFontName.endsWith("'"))
    ) {
      cleanedFontName = cleanedFontName.slice(1, -1);
    }
    return cleanedFontName;
  }

  private static getPlatformFontFallbacks(platform: OsType): string {
    switch (platform) {
      case "macos":
        return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace";
      case "windows":
        return "Consolas, Courier New, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
      case "linux":
        return "Liberation Mono, DejaVu Sans Mono, ui-monospace, Consolas, monospace";
    }
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static clone<T>(value: T): T | undefined {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  private static applyDiagnosticsAndStrip(
    target: Record<string, unknown>,
    defaults: Record<string, unknown>,
    error: z.ZodError,
    diagnostics: ConfigDiagnostic[],
  ): boolean {
    let changed = false;
    for (const issue of error.issues) {
      const path = issue.path.filter(
        (part): part is string | number => typeof part === "string" || typeof part === "number",
      );
      if (issue.code === "unrecognized_keys") {
        const pathLabel = ConfigReader.pathToString(path);
        diagnostics.push({
          level: "warning",
          message: `Unknown setting(s) at ${pathLabel}: ${issue.keys.join(", ")}`,
        });
        const parent = ConfigReader.getByPath(target, path);
        if (parent && typeof parent === "object") {
          for (const key of issue.keys) {
            if (key in parent) {
              delete (parent as Record<string, unknown>)[key];
              changed = true;
            }
          }
        }
        continue;
      }

      const pathLabel = ConfigReader.pathToString(path);
      diagnostics.push({
        level: "error",
        message: `${pathLabel}: ${issue.message}`,
      });
      if (path.length > 0) {
        const fallback = ConfigReader.getByPath(defaults, path);
        if (fallback !== undefined) {
          if (ConfigReader.setByPath(target, path, ConfigReader.clone(fallback))) {
            changed = true;
          }
        } else if (ConfigReader.deleteByPath(target, path)) {
          diagnostics.push({
            level: "warning",
            message: `${pathLabel}: Removed setting (no default available).`,
          });
          changed = true;
        }
      }
    }
    return changed;
  }

  private static pathToString(path: ReadonlyArray<string | number>): string {
    if (path.length === 0) {
      return "<root>";
    }
    return path.map((part) => (typeof part === "number" ? `[${part}]` : part)).join(".");
  }

  private static getByPath(
    target: Record<string, unknown>,
    path: ReadonlyArray<string | number>,
  ): unknown {
    let currentValue: unknown = target;
    for (const pathSegment of path) {
      if (currentValue === undefined || currentValue === null) {
        return undefined;
      }
      if (typeof pathSegment === "number") {
        if (!Array.isArray(currentValue)) {
          return undefined;
        }
        currentValue = currentValue[pathSegment];
      } else {
        if (typeof currentValue !== "object") {
          return undefined;
        }
        currentValue = (currentValue as Record<string, unknown>)[pathSegment];
      }
    }
    return currentValue;
  }

  private static deleteByPath(
    target: Record<string, unknown>,
    path: ReadonlyArray<string | number>,
  ): boolean {
    if (path.length === 0) {
      return false;
    }

    const parentPath = path.slice(0, -1);
    const leafPathSegment = path[path.length - 1];
    const parent = parentPath.length === 0 ? target : ConfigReader.getByPath(target, parentPath);
    if (parent === undefined || parent === null) {
      return false;
    }
    if (typeof leafPathSegment === "number" && Array.isArray(parent)) {
      if (leafPathSegment < 0 || leafPathSegment >= parent.length) {
        return false;
      }
      parent.splice(leafPathSegment, 1);
      return true;
    }
    if (typeof parent === "object" && Object.hasOwn(parent, leafPathSegment as string)) {
      delete (parent as Record<string, unknown>)[leafPathSegment as string];
      return true;
    }
    return false;
  }

  private static setByPath(
    target: Record<string, unknown>,
    path: ReadonlyArray<string | number>,
    value: unknown,
  ): boolean {
    if (path.length === 0) {
      return false;
    }

    let currentValue: unknown = target;
    for (let index = 0; index < path.length - 1; index++) {
      const pathSegment = path[index];
      if (typeof pathSegment === "number") {
        if (!Array.isArray(currentValue)) {
          return false;
        }
        currentValue[pathSegment] ??= {};
        currentValue = currentValue[pathSegment];
      } else {
        if (typeof currentValue !== "object" || currentValue === null) {
          return false;
        }
        const currentObject = currentValue as Record<string, unknown>;
        currentObject[pathSegment] ??= {};
        currentValue = currentObject[pathSegment];
      }
    }

    const leafPathSegment = path[path.length - 1];
    if (typeof leafPathSegment === "number") {
      if (!Array.isArray(currentValue)) {
        return false;
      }
      currentValue[leafPathSegment] = value;
      return true;
    }
    if (typeof currentValue !== "object" || currentValue === null) {
      return false;
    }
    (currentValue as Record<string, unknown>)[leafPathSegment] = value;
    return true;
  }

  static parseConfigString(text: string, schema?: z.ZodType): Record<string, unknown> {
    const root: Record<string, unknown> = {};
    const lines = (text || "").split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const configEntryMatch = trimmedLine.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (!configEntryMatch) {
        continue;
      }

      const configKey = configEntryMatch[1];
      const configValueString = configEntryMatch[2].trim();
      const valueSchema = ConfigReader.getSchemaAtDotPath(schema, configKey);
      const configValue = ConfigReader.parseValue(configValueString, valueSchema);
      ConfigReader.setDotPath(root, configKey, configValue, valueSchema);
    }

    return root;
  }

  private static setDotPath(
    target: Record<string, unknown>,
    dottedPath: string,
    value: unknown,
    schema?: z.ZodType,
  ): void {
    const pathSegments = dottedPath.split(".");
    let currentObject: Record<string, unknown> = target;
    for (let index = 0; index < pathSegments.length - 1; index++) {
      const pathSegment = pathSegments[index];
      if (!ConfigReader.isPlainObject(currentObject[pathSegment])) {
        currentObject[pathSegment] = {};
      }
      currentObject = currentObject[pathSegment] as Record<string, unknown>;
    }

    const leafPathSegment = pathSegments[pathSegments.length - 1];
    if (ConfigReader.isArraySchema(schema) && !Array.isArray(value)) {
      const existingKeybindValue = currentObject[leafPathSegment];
      if (existingKeybindValue === undefined) {
        currentObject[leafPathSegment] = [value];
      } else if (Array.isArray(existingKeybindValue)) {
        existingKeybindValue.push(value);
      } else {
        currentObject[leafPathSegment] = [existingKeybindValue, value];
      }
      return;
    }

    currentObject[leafPathSegment] = value;
  }

  private static parseValue(rawValue: string, schema?: z.ZodType): unknown {
    const trimmedValue = rawValue.trim();
    if (
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
    ) {
      return trimmedValue.slice(1, -1);
    }

    const schemaValue = ConfigReader.parseValueForSchema(trimmedValue, schema);
    if (schemaValue !== undefined) {
      return schemaValue;
    }

    if (trimmedValue === "true") {
      return true;
    }
    if (trimmedValue === "false") {
      return false;
    }
    if (/^-?\d+$/.test(trimmedValue)) {
      return Number(trimmedValue);
    }
    if (/^-?\d+\.\d+$/.test(trimmedValue)) {
      return Number(trimmedValue);
    }
    if (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) {
      const arrayContent = trimmedValue.slice(1, -1).trim();
      if (!arrayContent) {
        return [];
      }
      return arrayContent
        .split(",")
        .map((arrayEntry) => ConfigReader.parseValue(arrayEntry.trim()));
    }
    return trimmedValue;
  }

  private static parseValueForSchema(rawValue: string, schema: z.ZodType | undefined): unknown {
    const unwrappedSchema = ConfigReader.unwrapSchema(schema);
    if (!unwrappedSchema) {
      return undefined;
    }

    if (ConfigReader.safeParseSchema(unwrappedSchema, rawValue).success) {
      return rawValue;
    }

    if (rawValue === "true" || rawValue === "false") {
      const booleanValue = rawValue === "true";
      if (ConfigReader.safeParseSchema(unwrappedSchema, booleanValue).success) {
        return booleanValue;
      }
    }

    if (/^-?\d+$/.test(rawValue) || /^-?\d+\.\d+$/.test(rawValue)) {
      const numberValue = Number(rawValue);
      if (ConfigReader.safeParseSchema(unwrappedSchema, numberValue).success) {
        return numberValue;
      }
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      const arraySchema = ConfigReader.unwrapSchema(unwrappedSchema);
      if (arraySchema && ConfigReader.isArraySchema(arraySchema)) {
        const arrayContent = rawValue.slice(1, -1).trim();
        if (!arrayContent) {
          return [];
        }
        const itemSchema = ConfigReader.getArrayItemSchema(arraySchema);
        if (!itemSchema) {
          return undefined;
        }
        const arrayValue = arrayContent
          .split(",")
          .map((arrayEntry) => ConfigReader.parseValue(arrayEntry.trim(), itemSchema));
        if (ConfigReader.safeParseSchema(arraySchema, arrayValue).success) {
          return arrayValue;
        }
      }
    }

    if (ConfigReader.isArraySchema(unwrappedSchema)) {
      const itemSchema = ConfigReader.getArrayItemSchema(unwrappedSchema);
      if (!itemSchema) {
        return undefined;
      }
      const itemValue = ConfigReader.parseValue(rawValue, itemSchema);
      if (ConfigReader.safeParseSchema(unwrappedSchema, [itemValue]).success) {
        return itemValue;
      }
    }

    return undefined;
  }

  private static getSchemaAtDotPath(
    schema: z.ZodType | undefined,
    dottedPath: string,
  ): z.ZodType | undefined {
    let currentSchema = ConfigReader.unwrapSchema(schema);
    for (const pathSegment of dottedPath.split(".")) {
      currentSchema = ConfigReader.getChildSchema(currentSchema, pathSegment);
      if (!currentSchema) {
        return undefined;
      }
    }
    return currentSchema;
  }

  private static getChildSchema(schema: z.ZodType | undefined, key: string): z.ZodType | undefined {
    const unwrappedSchema = ConfigReader.unwrapSchema(schema);
    if (!unwrappedSchema) {
      return undefined;
    }

    const definition = ConfigReader.getSchemaDefinition(unwrappedSchema);
    if (definition?.["type"] === "object") {
      const shape = ConfigReader.getObjectShape(unwrappedSchema);
      return ConfigReader.isPlainObject(shape) ? (shape[key] as z.ZodType | undefined) : undefined;
    }
    if (definition?.["type"] === "record") {
      return definition["valueType"] as z.ZodType | undefined;
    }
    if (definition?.["type"] === "union") {
      for (const option of definition["options"] as z.ZodType[]) {
        const childSchema = ConfigReader.getChildSchema(option, key);
        if (childSchema) {
          return childSchema;
        }
      }
    }
    return undefined;
  }

  private static unwrapSchema(schema: z.ZodType | undefined): z.ZodType | undefined {
    let currentSchema: z.ZodType | undefined = schema;
    while (currentSchema) {
      const definition = ConfigReader.getSchemaDefinition(currentSchema);
      if (definition?.["innerType"]) {
        currentSchema = definition["innerType"] as z.ZodType;
        continue;
      }
      if (definition?.["schema"]) {
        currentSchema = definition["schema"] as z.ZodType;
        continue;
      }
      break;
    }
    return currentSchema;
  }

  private static isArraySchema(schema: z.ZodType | undefined): schema is z.ZodType {
    return (
      ConfigReader.getSchemaDefinition(ConfigReader.unwrapSchema(schema))?.["type"] === "array"
    );
  }

  private static getArrayItemSchema(schema: z.ZodType): z.ZodType | undefined {
    const definition = ConfigReader.getSchemaDefinition(ConfigReader.unwrapSchema(schema));
    return definition?.["element"] as z.ZodType | undefined;
  }

  private static getObjectShape(schema: z.ZodType): unknown {
    const definition = ConfigReader.getSchemaDefinition(schema);
    const shape = definition?.["shape"];
    return typeof shape === "function" ? shape() : shape;
  }

  private static getSchemaDefinition(
    schema: z.ZodType | undefined,
  ): Record<string, unknown> | undefined {
    if (!schema || !ConfigReader.isPlainObject(schema)) {
      return undefined;
    }
    const definition = schema["def"] ?? schema["_def"];
    return ConfigReader.isPlainObject(definition) ? definition : undefined;
  }

  private static safeParseSchema(
    schema: z.ZodType,
    value: unknown,
  ): ReturnType<z.ZodType["safeParse"]> {
    return schema.safeParse(value);
  }
}

function mergeConfigObjects(
  baseConfig: Readonly<Record<string, unknown>>,
  overridingConfig: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const mergedConfig: Record<string, unknown> = { ...baseConfig };

  for (const [configKey, overridingValue] of Object.entries(overridingConfig)) {
    const baseValue = mergedConfig[configKey];
    mergedConfig[configKey] = mergeConfigObjectValue(baseValue, overridingValue);
  }

  return mergedConfig;
}

function mergeConfigObjectValue(baseValue: unknown, overridingValue: unknown): unknown {
  if (overridingValue === undefined) {
    return cloneConfigObjectValue(baseValue);
  }

  if (
    typeof baseValue !== "object" ||
    baseValue === null ||
    Array.isArray(baseValue) ||
    typeof overridingValue !== "object" ||
    overridingValue === null ||
    Array.isArray(overridingValue)
  ) {
    return cloneConfigObjectValue(overridingValue);
  }

  return mergeConfigObjects(
    baseValue as Record<string, unknown>,
    overridingValue as Record<string, unknown>,
  );
}

function cloneConfigObjectValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function resolveSettingsExtensions(
  settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract> | undefined,
): ReadonlyArray<ApplicationSettingsExtensionContract> {
  if (settingsExtensions === undefined || settingsExtensions.length === 0) {
    return [defaultFeatureSettingsExtension];
  }

  return settingsExtensions;
}
