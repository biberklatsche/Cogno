import { Config } from "./models/config";

interface DotStringOptions {
  readonly defaultSettings?: Config;
}

/**
 * Writes the initial user config as a compact overrides file.
 */
export class InitialConfigOverridesWriter {
  public static toDotString(settings: Config, options: DotStringOptions = {}): string {
    const { defaultSettings } = options;
    const effectiveSettings =
      defaultSettings === undefined
        ? settings
        : InitialConfigOverridesWriter.extractOverrides(settings, defaultSettings);
    const lines = InitialConfigOverridesWriter.toDotProperties(effectiveSettings);
    return lines.join("\n") + (lines.length ? "\n" : "");
  }

  private static extractOverrides(
    settings: unknown,
    defaultSettings: unknown,
  ): Record<string, unknown> {
    const overrides = InitialConfigOverridesWriter.extractOverrideValue(settings, defaultSettings);
    return InitialConfigOverridesWriter.isPlainObject(overrides) ? overrides : {};
  }

  private static extractOverrideValue(settings: unknown, defaultSettings: unknown): unknown {
    if (Array.isArray(settings)) {
      return InitialConfigOverridesWriter.areArraysEqual(settings, defaultSettings)
        ? undefined
        : settings;
    }

    if (InitialConfigOverridesWriter.isPlainObject(settings)) {
      const defaultObject = InitialConfigOverridesWriter.isPlainObject(defaultSettings)
        ? defaultSettings
        : {};
      const overrideEntries = Object.entries(settings)
        .map(
          ([configKey, configValue]) =>
            [
              configKey,
              InitialConfigOverridesWriter.extractOverrideValue(
                configValue,
                defaultObject[configKey],
              ),
            ] as const,
        )
        .filter(([, overrideValue]) => overrideValue !== undefined);

      return overrideEntries.length > 0 ? Object.fromEntries(overrideEntries) : undefined;
    }

    return Object.is(settings, defaultSettings) ? undefined : settings;
  }

  private static areArraysEqual(
    settings: ReadonlyArray<unknown>,
    defaultSettings: unknown,
  ): boolean {
    if (!Array.isArray(defaultSettings) || settings.length !== defaultSettings.length) {
      return false;
    }

    return settings.every((entry, index) =>
      InitialConfigOverridesWriter.areValuesEqual(entry, defaultSettings[index]),
    );
  }

  private static areValuesEqual(leftValue: unknown, rightValue: unknown): boolean {
    if (Array.isArray(leftValue)) {
      return InitialConfigOverridesWriter.areArraysEqual(leftValue, rightValue);
    }

    if (InitialConfigOverridesWriter.isPlainObject(leftValue)) {
      if (!InitialConfigOverridesWriter.isPlainObject(rightValue)) {
        return false;
      }

      const leftEntries = Object.entries(leftValue);
      const rightEntries = Object.entries(rightValue);
      if (leftEntries.length !== rightEntries.length) {
        return false;
      }

      return leftEntries.every(([configKey, configValue]) =>
        InitialConfigOverridesWriter.areValuesEqual(configValue, rightValue[configKey]),
      );
    }

    return Object.is(leftValue, rightValue);
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static renderValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  }

  private static toDotProperties(obj: Record<string, unknown>, prefix: string = ""): string[] {
    const lines: string[] = [];

    for (const configKey of Object.keys(obj).sort()) {
      const configValue = obj[configKey];
      const key = prefix ? `${prefix}.${configKey}` : configKey;

      if (InitialConfigOverridesWriter.isPlainObject(configValue)) {
        lines.push(...InitialConfigOverridesWriter.toDotProperties(configValue, key));
      } else if (Array.isArray(configValue)) {
        if (key === "keybind") {
          // Keybinds are output on multiple lines
          for (const item of configValue) {
            lines.push(`${key} = ${InitialConfigOverridesWriter.renderValue(item)}`);
          }
        } else {
          // Other arrays as comma-separated list
          const items = configValue.map((item) => InitialConfigOverridesWriter.renderValue(item));
          lines.push(`${key} = [${items.join(",")}]`);
        }
      } else {
        lines.push(`${key} = ${InitialConfigOverridesWriter.renderValue(configValue)}`);
      }
    }
    return lines;
  }
}
