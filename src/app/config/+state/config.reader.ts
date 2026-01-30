import {Config, ConfigSchema} from "../+models/config";
import {OS, OsType} from "../../_tauri/os";

/**
 * Reader class for reading/validating the configuration.
 * Currently, it delegates to the existing ConfigCodec implementation,
 * so that existing functionality is preserved while providing a clear
 * separation of responsibilities.
 */
export class ConfigReader {
  /** Parses two configuration strings (defaults and user) and returns a validated, merged config. */
  static fromStringToConfig(defaultConfigString: string, userConfigString: string): Config;
  /** Backward compatible: If only one string is passed, it is interpreted as user config (without defaults). */
  static fromStringToConfig(userConfigStringOnly: string): Config;
  static fromStringToConfig(a: string, b?: string): Config {
      const defaultConfigString = b === undefined ? "" : a;
      const userConfigString = b === undefined ? a : b;
      const userConfig = this.parseConfigString(userConfigString || "");
      const defaultConfig = this.parseConfigString(defaultConfigString || "");
      return this.toConfig(defaultConfig, userConfig);
  }

    /** Merges default values with user overrides and validates.
     *  Rule: All keys are replaced (user overrides default), except for 'keybind': there arrays
     *  are merged: first default entries, then user entries. Other arrays are replaced.
     */
    private static toConfig(defaultConfig: Record<string, unknown>, userConfig: Record<string, unknown>): Config {
        const merge = (defs: any, usr: any): any => {
            // If user is not set: take defaults completely
            if (usr === undefined) return this.clone(defs);
            // If one of them is not a plain object (or array), replace completely by user
            if (Array.isArray(usr)) {
                return usr;
            }
            if (Array.isArray(defs)) {
                // If user is not an array, also replace with user (schema validation takes care later)
                return usr;
            }
            if (!this.isPlainObject(usr) || !this.isPlainObject(defs)) {
                return usr;
            }
            // Both are plain objects: deep merge
            const out: any = {};
            const keys = new Set<string>([...Object.keys(defs || {}), ...Object.keys(usr || {})]);
            for (const key of keys) {
                if (key === 'keybind') {
                    const d = defs?.[key];
                    const u = usr?.[key];
                    const dArr = Array.isArray(d) ? d : (d === undefined ? [] : [d]);
                    const uArr = Array.isArray(u) ? u : (u === undefined ? [] : [u]);
                    out[key] = [...dArr, ...uArr];
                    continue;
                }
                out[key] = merge(defs?.[key], usr?.[key]);
            }
            return out;
        };

        const merged = merge(defaultConfig ?? {}, userConfig ?? {});
        const config = ConfigSchema.parse(merged);

        // Add platform-specific font fallbacks
        if (config.font?.family) {
            config.font.family = this.addFontFallbacks(config.font.family);
        }

        return config;
    }

    /**
     * Adds platform-specific font fallbacks to the font family string.
     * - macOS: ui-monospace, SFMono-Regular, Menlo, Monaco
     * - Windows: Consolas, Courier New
     * - Linux: Liberation Mono, DejaVu Sans Mono, monospace
     */
    private static addFontFallbacks(fontFamily: string): string {
        const platform = OS.platform();
        const fallbacks = this.getPlatformFontFallbacks(platform);
        const cleanedFontFamily = this.quoteFontName(fontFamily);

        // If the font is a generic keyword (monospace, sans-serif, etc),
        // don't add it at the beginning - it's already in the fallback list
        const genericFonts = ['monospace', 'sans-serif', 'serif', 'cursive', 'fantasy'];
        if (genericFonts.includes(cleanedFontFamily.toLowerCase())) {
            return fallbacks;
        }
        return `${cleanedFontFamily}, ${fallbacks}`;
    }

    private static quoteFontName(fontName: string): string {
        // Simply return the font name without adding quotes
        // The quotes will be handled by CSS/xterm.js when needed
        let cleaned = fontName.trim();
        // Remove surrounding quotes if present (both at start AND end)
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.slice(1, -1);
        }
        return cleaned;
    }

    private static getPlatformFontFallbacks(platform: OsType): string {
        switch (platform) {
            case 'macos':
                return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace';
            case 'windows':
                return 'Consolas, Courier New, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
            case 'linux':
                return 'Liberation Mono, DejaVu Sans Mono, ui-monospace, Consolas, monospace';
        }
    }

    private static isPlainObject(v: unknown): v is Record<string, unknown> {
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }

    private static clone<T>(v: T): T | undefined {
        if(v === undefined) return undefined
        return JSON.parse(JSON.stringify(v));
    }

    /** Liest einen User-Settings-String (key=value, Dot-Pfade) in ein verschachteltes Objekt ein. */
    private static parseConfigString(input: string): Record<string, unknown> {
        const out: Record<string, unknown> = {};

        for (const rawLine of input.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#") || line.startsWith(";")) continue;

            const indexOfEqual = line.indexOf("=");
            if (indexOfEqual === -1) continue;

            let key = line.slice(0, indexOfEqual).trim();
            let rawVal = line.slice(indexOfEqual + 1).trim();

            let value: unknown = rawVal;
            if (
                (rawVal.startsWith("[") && rawVal.endsWith("]"))
            ) {
                rawVal = rawVal.slice(1, -1);
                value = rawVal.split(',').map(v => this.parseValue(v));
            } else {
                value = this.parseValue(rawVal);
            }

            // Dot-Pfad eintragen
            const parts = key.split(".");
            let cur: any = out;
            while (parts.length > 1) {
                const p = parts.shift()!;
                cur[p] ??= {};
                cur = cur[p];
            }
            const last = parts[0];
            const prev = cur[last];
            if (prev === undefined) {
                cur[last] = value;
            } else if (Array.isArray(prev)) {
                prev.push(value);
            } else {
                cur[last] = [prev, value];
            }
        }
        return out;
    }

    private static parseValue(rawVal: string): boolean | number | string | undefined {
        if(rawVal.length === 0) return undefined;
        // Quoted strings: unwrap first (so "false" stays a string, not boolean)
        const isDq = rawVal.length >= 2 && rawVal.startsWith('"') && rawVal.endsWith('"');
        const isSq = rawVal.length >= 2 && rawVal.startsWith("'") && rawVal.endsWith("'");
        if (isDq) {
            rawVal = rawVal.slice(1, -1);
        } else if (isSq) {
            // For single quotes, just strip the outer quotes
            rawVal = rawVal.slice(1, -1);
        }
        if (/^-?\d+$/.test(rawVal) || /^-?\d+\.\d+$/.test(rawVal)) {
            // Primitive Heuristiken: number
            return Number(rawVal);
        } else if (rawVal === "true") {
            return true;
        } else if (rawVal === "false") {
            return false;
        }
        return rawVal;
    }
}
