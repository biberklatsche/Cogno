import type { ApplicationSettingsExtensionContract } from "@cogno/core-sdk";
import { featureSettingsExtension } from "@cogno/features";
import { z } from "zod";
import { OS, OsType } from "../../_tauri/os";
import { Config } from "../+models/config";
import { createApplicationSettingsDefinition } from "../application-settings-definition";

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
    const userConfig = this.parseConfigString(userConfigString || "");
    const defaultConfig = this.parseConfigString(defaultConfigString || "");
    return this.toConfigWithDiagnostics(defaultConfig, userConfig, settingsExtensions).config;
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
    const userConfig = this.parseConfigString(userConfigString || "");
    const defaultConfig = this.parseConfigString(defaultConfigString || "");
    return this.toConfigWithDiagnostics(defaultConfig, userConfig, settingsExtensions);
  }

  private static toConfigWithDiagnostics(
    defaultConfig: Record<string, unknown>,
    userConfig: Record<string, unknown>,
    settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract>,
  ): { config: Config; diagnostics: ConfigDiagnostic[] } {
    const applicationSettingsDefinition = createApplicationSettingsDefinition(settingsExtensions);
    const defaultConfigWithExtensions = mergeConfigObjects(
      defaultConfig ?? {},
      applicationSettingsDefinition.defaults,
    );
    const mergedConfig = this.mergeConfigValues(
      defaultConfigWithExtensions,
      userConfig ?? {},
    ) as Record<string, unknown>;
    const diagnostics: ConfigDiagnostic[] = [];
    const initialCandidate = this.clone(mergedConfig);
    let candidate: Record<string, unknown> =
      initialCandidate === undefined ? {} : initialCandidate;

    for (let attempt = 0; attempt < 10; attempt++) {
      const result = applicationSettingsDefinition.schema.safeParse(candidate);
      if (result.success) {
        const config = result.data as Config;
        if (config.font?.family) {
          config.font.family = this.addFontFallbacks(config.font.family);
        }
        return { config, diagnostics };
      }
      const changed = this.applyDiagnosticsAndStrip(
        candidate,
        defaultConfigWithExtensions,
        result.error,
        diagnostics,
      );
      if (!changed) {
        break;
      }
      const clonedCandidate = this.clone(candidate);
      candidate = clonedCandidate === undefined ? {} : clonedCandidate;
    }

    const fallbackResult = applicationSettingsDefinition.schema.safeParse(defaultConfigWithExtensions);
    const emptyResult = fallbackResult.success
      ? fallbackResult
      : applicationSettingsDefinition.schema.safeParse({});
    const fallback = (emptyResult.success ? emptyResult.data : {}) as Config;
    if (fallback.font?.family) {
      fallback.font.family = this.addFontFallbacks(fallback.font.family);
    }
    diagnostics.push({
      level: "error",
      message: "Invalid configuration entries were ignored. Defaults were used where needed.",
    });
    return { config: fallback, diagnostics };
  }

  private static mergeConfigValues(defaultValue: unknown, userValue: unknown): unknown {
    if (userValue === undefined) {
      return this.clone(defaultValue);
    }
    if (Array.isArray(userValue)) {
      return userValue;
    }
    if (Array.isArray(defaultValue)) {
      return userValue;
    }
    if (!this.isPlainObject(userValue) || !this.isPlainObject(defaultValue)) {
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

      mergedConfig[configKey] = this.mergeConfigValues(
        defaultValue[configKey],
        userValue[configKey],
      );
    }

    return mergedConfig;
  }

  private static addFontFallbacks(fontFamily: string): string {
    const platform = OS.platform();
    const fallbacks = this.getPlatformFontFallbacks(platform);
    const cleanedFontFamily = this.quoteFontName(fontFamily);
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
        const pathLabel = this.pathToString(path);
        diagnostics.push({
          level: "warning",
          message: `Unknown setting(s) at ${pathLabel}: ${issue.keys.join(", ")}`,
        });
        const parent = this.getByPath(target, path);
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

      const pathLabel = this.pathToString(path);
      diagnostics.push({
        level: "error",
        message: `${pathLabel}: ${issue.message}`,
      });
      if (path.length > 0) {
        const fallback = this.getByPath(defaults, path);
        if (fallback !== undefined) {
          if (this.setByPath(target, path, this.clone(fallback))) {
            changed = true;
          }
        } else if (this.deleteByPath(target, path)) {
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
    return path.map(part => (typeof part === "number" ? `[${part}]` : part)).join(".");
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
    const parent = parentPath.length === 0 ? target : this.getByPath(target, parentPath);
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
    if (
      typeof parent === "object" &&
      Object.prototype.hasOwnProperty.call(parent, leafPathSegment as string)
    ) {
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

  static parseConfigString(text: string): Record<string, unknown> {
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
      const configValue = this.parseValue(configValueString);
      this.setDotPath(root, configKey, configValue);
    }

    return root;
  }

  private static setDotPath(
    target: Record<string, unknown>,
    dottedPath: string,
    value: unknown,
  ): void {
    const pathSegments = dottedPath.split(".");
    let currentObject: Record<string, unknown> = target;
    for (let index = 0; index < pathSegments.length - 1; index++) {
      const pathSegment = pathSegments[index];
      if (!this.isPlainObject(currentObject[pathSegment])) {
        currentObject[pathSegment] = {};
      }
      currentObject = currentObject[pathSegment] as Record<string, unknown>;
    }

    const leafPathSegment = pathSegments[pathSegments.length - 1];
    if (leafPathSegment === "keybind") {
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

  private static parseValue(rawValue: string): unknown {
    const trimmedValue = rawValue.trim();
    if (
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
    ) {
      return trimmedValue.slice(1, -1);
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
      return arrayContent.split(",").map(arrayEntry => this.parseValue(arrayEntry.trim()));
    }
    return trimmedValue;
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
    return [featureSettingsExtension];
  }

  return settingsExtensions;
}
