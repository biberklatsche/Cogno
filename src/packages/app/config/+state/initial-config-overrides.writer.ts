import { Config, ConfigSchema } from "../+models/config";

interface DotStringOptions {
  readonly defaultSettings?: Config;
  readonly asComments?: boolean;
}

/**
 * Writes the initial user config as a compact overrides file.
 */
export class InitialConfigOverridesWriter {
  public static toDotString(settings: Config, options: DotStringOptions = {}): string {
    const { defaultSettings, asComments = false } = options;
    const effectiveSettings =
      defaultSettings === undefined
        ? settings
        : InitialConfigOverridesWriter.extractOverrides(settings, defaultSettings);
    const lines = InitialConfigOverridesWriter.toDotProperties(
      effectiveSettings,
      "",
      ConfigSchema,
      asComments,
    );
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

  private static addSchemaDescription(lines: string[], schema: unknown): void {
    const desc = InitialConfigOverridesWriter.getSchemaDescription(schema);
    if (desc) {
      for (const line of String(desc).split(/\r?\n/)) {
        lines.push(`# ${line.trim()}`);
      }
    }
  }

  private static toDotProperties(
    obj: Record<string, unknown>,
    prefix: string = "",
    schema?: unknown,
    asComment: boolean = true,
  ): string[] {
    const lines: string[] = [];

    for (const configKey of Object.keys(obj).sort()) {
      const configValue = obj[configKey];
      const key = prefix ? `${prefix}.${configKey}` : configKey;
      const childSchema = InitialConfigOverridesWriter.getChildSchema(schema, configKey);
      const commentPrefix = asComment ? "# " : "";

      if (InitialConfigOverridesWriter.isPlainObject(configValue)) {
        const unwrapped = InitialConfigOverridesWriter.unwrapSchema(childSchema);
        lines.push(
          ...InitialConfigOverridesWriter.toDotProperties(configValue, key, unwrapped, asComment),
        );
      } else if (Array.isArray(configValue)) {
        if (asComment) {
          InitialConfigOverridesWriter.addSchemaDescription(lines, childSchema);
        }

        if (key === "keybind") {
          // Keybinds are output on multiple lines
          for (const item of configValue) {
            lines.push(
              `${commentPrefix}${key} = ${InitialConfigOverridesWriter.renderValue(item)}`,
            );
          }
        } else {
          // Other arrays as comma-separated list
          const items = configValue.map((item) => InitialConfigOverridesWriter.renderValue(item));
          lines.push(`${commentPrefix}${key} = [${items.join(",")}]`);
        }
      } else {
        if (asComment) {
          InitialConfigOverridesWriter.addSchemaDescription(lines, childSchema);
        }
        lines.push(
          `${commentPrefix}${key} = ${InitialConfigOverridesWriter.renderValue(configValue)}`,
        );
      }
    }
    return lines;
  }

  private static unwrapSchema(schema: unknown): unknown {
    let currentSchema = schema;
    while (InitialConfigOverridesWriter.hasDefinition(currentSchema)) {
      if (currentSchema._def["innerType"]) {
        currentSchema = currentSchema._def["innerType"];
        continue;
      }
      if (currentSchema._def["schema"]) {
        currentSchema = currentSchema._def["schema"];
        continue;
      }
      break;
    }
    return currentSchema;
  }

  private static getChildSchema(parent: unknown, key: string): unknown {
    if (!parent) return undefined;

    const parentSchema = InitialConfigOverridesWriter.unwrapSchema(parent);
    if (!InitialConfigOverridesWriter.hasDefinition(parentSchema)) {
      return undefined;
    }
    const def = parentSchema._def;
    if (!def) return undefined;

    const shape = InitialConfigOverridesWriter.extractShape(parentSchema, def);
    if (!shape) return undefined;

    if (Object.hasOwn(shape, key)) {
      const rawChild = shape[key];
      if (typeof rawChild === "function") {
        try {
          return rawChild();
        } catch {
          return undefined;
        }
      }
      return rawChild;
    }
    return undefined;
  }

  private static extractShape(
    schemaInstance: unknown,
    def: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const instanceShape = InitialConfigOverridesWriter.getShapeFromContainer(schemaInstance);
    if (instanceShape) {
      return instanceShape;
    }

    const definitionShape = def["shape"];
    if (typeof definitionShape === "function") {
      const resolvedShape = definitionShape();
      return InitialConfigOverridesWriter.isPlainObject(resolvedShape) ? resolvedShape : undefined;
    }
    return InitialConfigOverridesWriter.isPlainObject(definitionShape)
      ? definitionShape
      : undefined;
  }

  private static getShapeFromContainer(container: unknown): Record<string, unknown> | undefined {
    if (!InitialConfigOverridesWriter.isPlainObject(container)) {
      return undefined;
    }

    const output = container["out"];
    if (!InitialConfigOverridesWriter.isPlainObject(output)) {
      return undefined;
    }

    const shape = output["shape"];
    if (typeof shape === "function") {
      const resolvedShape = shape.call(container);
      return InitialConfigOverridesWriter.isPlainObject(resolvedShape) ? resolvedShape : undefined;
    }

    return InitialConfigOverridesWriter.isPlainObject(shape) ? shape : undefined;
  }

  private static hasDefinition(value: unknown): value is { _def: Record<string, unknown> } {
    return (
      InitialConfigOverridesWriter.isPlainObject(value) &&
      InitialConfigOverridesWriter.isPlainObject(value["_def"])
    );
  }

  private static getSchemaDescription(schema: unknown): string | undefined {
    if (!schema) return undefined;

    if (InitialConfigOverridesWriter.isPlainObject(schema)) {
      const directDescription = schema["description"];
      if (typeof directDescription === "string" && directDescription.length > 0) {
        return directDescription;
      }
    }

    const unwrappedSchema = InitialConfigOverridesWriter.unwrapSchema(schema);
    if (!InitialConfigOverridesWriter.isPlainObject(unwrappedSchema)) {
      return undefined;
    }

    const description = unwrappedSchema["description"];
    return typeof description === "string" && description.length > 0 ? description : undefined;
  }
}
