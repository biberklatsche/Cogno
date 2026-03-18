import { Config, ConfigSchema } from "../+models/config";

/**
 * Writes the initial user config as a compact overrides file.
 */
export class InitialConfigOverridesWriter {

    public static toDotString(
        settings: Config,
        defaultSettingsOrAsComments?: Config | boolean,
        asComments: boolean = false,
    ): string {
        const defaultSettings = typeof defaultSettingsOrAsComments === "boolean"
            ? undefined
            : defaultSettingsOrAsComments;
        const shouldRenderComments = typeof defaultSettingsOrAsComments === "boolean"
            ? defaultSettingsOrAsComments
            : asComments;
        const effectiveSettings = defaultSettings === undefined
            ? settings
            : this.extractOverrides(settings, defaultSettings);
        const lines = this.toDotProperties(effectiveSettings, "", ConfigSchema, shouldRenderComments);
        return lines.join("\n") + (lines.length ? "\n" : "");
    }

    private static extractOverrides(
        settings: unknown,
        defaultSettings: unknown,
    ): Record<string, unknown> {
        const overrides = this.extractOverrideValue(settings, defaultSettings);
        return this.isPlainObject(overrides) ? overrides : {};
    }

    private static extractOverrideValue(
        settings: unknown,
        defaultSettings: unknown,
    ): unknown {
        if (Array.isArray(settings)) {
            return this.areArraysEqual(settings, defaultSettings) ? undefined : settings;
        }

        if (this.isPlainObject(settings)) {
            const defaultObject = this.isPlainObject(defaultSettings) ? defaultSettings : {};
            const overrideEntries = Object.entries(settings)
                .map(([configKey, configValue]) => [
                    configKey,
                    this.extractOverrideValue(configValue, defaultObject[configKey]),
                ] as const)
                .filter(([, overrideValue]) => overrideValue !== undefined);

            return overrideEntries.length > 0
                ? Object.fromEntries(overrideEntries)
                : undefined;
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
            this.areValuesEqual(entry, defaultSettings[index]),
        );
    }

    private static areValuesEqual(leftValue: unknown, rightValue: unknown): boolean {
        if (Array.isArray(leftValue)) {
            return this.areArraysEqual(leftValue, rightValue);
        }

        if (this.isPlainObject(leftValue)) {
            if (!this.isPlainObject(rightValue)) {
                return false;
            }

            const leftEntries = Object.entries(leftValue);
            const rightEntries = Object.entries(rightValue);
            if (leftEntries.length !== rightEntries.length) {
                return false;
            }

            return leftEntries.every(([configKey, configValue]) =>
                this.areValuesEqual(configValue, rightValue[configKey]),
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
        const desc = this.getSchemaDescription(schema);
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
            const childSchema = this.getChildSchema(schema, configKey);
            const commentPrefix = asComment ? "# " : "";

            if (this.isPlainObject(configValue)) {
                const unwrapped = this.unwrapSchema(childSchema);
                lines.push(...this.toDotProperties(configValue, key, unwrapped, asComment));
            } else if (Array.isArray(configValue)) {
                if (asComment) {
                    this.addSchemaDescription(lines, childSchema);
                }

                if (key === "keybind") {
                    // Keybinds are output on multiple lines
                    for (const item of configValue) {
                        lines.push(`${commentPrefix}${key} = ${this.renderValue(item)}`);
                    }
                } else {
                    // Other arrays as comma-separated list
                    const items = configValue.map(item => this.renderValue(item));
                    lines.push(`${commentPrefix}${key} = [${items.join(",")}]`);
                }
            } else {
                if (asComment) {
                    this.addSchemaDescription(lines, childSchema);
                }
                lines.push(`${commentPrefix}${key} = ${this.renderValue(configValue)}`);
            }
        }
        return lines;
    }

    private static unwrapSchema(schema: unknown): unknown {
        let currentSchema = schema;
        while (this.hasDefinition(currentSchema)) {
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

        const parentSchema = this.unwrapSchema(parent);
        if (!this.hasDefinition(parentSchema)) {
            return undefined;
        }
        const def = parentSchema._def;
        if (!def) return undefined;

        const shape = this.extractShape(parentSchema, def);
        if (!shape) return undefined;

        if (Object.prototype.hasOwnProperty.call(shape, key)) {
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
        const instanceShape = this.getShapeFromContainer(schemaInstance);
        if (instanceShape) {
            return instanceShape;
        }

        const definitionShape = def["shape"];
        if (typeof definitionShape === "function") {
            const resolvedShape = definitionShape();
            return this.isPlainObject(resolvedShape) ? resolvedShape : undefined;
        }
        return this.isPlainObject(definitionShape) ? definitionShape : undefined;
    }

    private static getShapeFromContainer(container: unknown): Record<string, unknown> | undefined {
        if (!this.isPlainObject(container)) {
            return undefined;
        }

        const output = container["out"];
        if (!this.isPlainObject(output)) {
            return undefined;
        }

        const shape = output["shape"];
        if (typeof shape === "function") {
            const resolvedShape = shape.call(container);
            return this.isPlainObject(resolvedShape) ? resolvedShape : undefined;
        }

        return this.isPlainObject(shape) ? shape : undefined;
    }

    private static hasDefinition(value: unknown): value is { _def: Record<string, unknown> } {
        return this.isPlainObject(value) && this.isPlainObject(value["_def"]);
    }

    private static getSchemaDescription(schema: unknown): string | undefined {
        if (!schema) return undefined;

        if (this.isPlainObject(schema)) {
            const directDescription = schema["description"];
            if (typeof directDescription === "string" && directDescription.length > 0) {
                return directDescription;
            }
        }

        const unwrappedSchema = this.unwrapSchema(schema);
        if (!this.isPlainObject(unwrappedSchema)) {
            return undefined;
        }

        const description = unwrappedSchema["description"];
        return typeof description === "string" && description.length > 0 ? description : undefined;
    }

}
