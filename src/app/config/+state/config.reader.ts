import {Config, ConfigSchema} from "../+models/config";
import {OS, OsType} from "../../_tauri/os";
import {z} from "zod";

export type ConfigDiagnostic = {
    level: 'warning' | 'error';
    message: string;
};

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
      return this.toConfigWithDiagnostics(defaultConfig, userConfig).config;
  }

    /** Same as fromStringToConfig, but also returns diagnostics for unknown/invalid settings. */
    static fromStringToConfigWithDiagnostics(defaultConfigString: string, userConfigString: string): {config: Config; diagnostics: ConfigDiagnostic[]};
    static fromStringToConfigWithDiagnostics(userConfigStringOnly: string): {config: Config; diagnostics: ConfigDiagnostic[]};
    static fromStringToConfigWithDiagnostics(a: string, b?: string): {config: Config; diagnostics: ConfigDiagnostic[]} {
        const defaultConfigString = b === undefined ? "" : a;
        const userConfigString = b === undefined ? a : b;
        const userConfig = this.parseConfigString(userConfigString || "");
        const defaultConfig = this.parseConfigString(defaultConfigString || "");
        return this.toConfigWithDiagnostics(defaultConfig, userConfig);
    }

    /** Merges default values with user overrides and validates.
     *  Rule: All keys are replaced (user overrides default), except for 'keybind': there arrays
     *  are merged: first default entries, then user entries. Other arrays are replaced.
     */
    private static toConfigWithDiagnostics(defaultConfig: Record<string, unknown>, userConfig: Record<string, unknown>): {config: Config; diagnostics: ConfigDiagnostic[]} {
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
        const diagnostics: ConfigDiagnostic[] = [];
        let candidate: Record<string, unknown> = this.clone(merged) ?? {};

        for (let attempt = 0; attempt < 10; attempt++) {
            const result = ConfigSchema.safeParse(candidate);
            if (result.success) {
                const config = result.data;
                if (config.font?.family) {
                    config.font.family = this.addFontFallbacks(config.font.family);
                }
                return {config, diagnostics};
            }
            const changed = this.applyDiagnosticsAndStrip(candidate, defaultConfig ?? {}, result.error, diagnostics);
            if (!changed) {
                break;
            }
            candidate = this.clone(candidate) ?? {};
        }

        const fallbackResult = ConfigSchema.safeParse(defaultConfig ?? {});
        const emptyResult = fallbackResult.success ? fallbackResult : ConfigSchema.safeParse({});
        const fallback = emptyResult.success ? emptyResult.data : ({} as Config);
        if (fallback.font?.family) {
            fallback.font.family = this.addFontFallbacks(fallback.font.family);
        }
        diagnostics.push({
            level: 'error',
            message: 'Invalid configuration entries were ignored. Defaults were used where needed.'
        });
        return {config: fallback, diagnostics};
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

    private static applyDiagnosticsAndStrip(
        target: Record<string, unknown>,
        defaults: Record<string, unknown>,
        error: z.ZodError,
        diagnostics: ConfigDiagnostic[]
    ): boolean {
        let changed = false;
        for (const issue of error.issues) {
            const path = issue.path.filter(part => typeof part === 'string' || typeof part === 'number') as (string | number)[];
            if (issue.code === 'unrecognized_keys') {
                const pathLabel = this.pathToString(path);
                diagnostics.push({
                    level: 'warning',
                    message: `Unknown setting(s) at ${pathLabel}: ${issue.keys.join(', ')}`
                });
                const parent = this.getByPath(target, path);
                if (parent && typeof parent === 'object') {
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
                level: 'error',
                message: `${pathLabel}: ${issue.message}`
            });
            if (path.length > 0) {
                const fallback = this.getByPath(defaults, path);
                if (fallback !== undefined) {
                    if (this.setByPath(target, path, this.clone(fallback))) {
                        changed = true;
                    }
                } else if (this.deleteByPath(target, path)) {
                    diagnostics.push({
                        level: 'warning',
                        message: `${pathLabel}: Removed setting (no default available).`
                    });
                    changed = true;
                }
            }
        }
        return changed;
    }

    private static pathToString(path: (string | number)[]): string {
        if (path.length === 0) return '<root>';
        return path.map(part => typeof part === 'number' ? `[${part}]` : part).join('.');
    }

    private static getByPath(target: Record<string, unknown>, path: (string | number)[]): unknown {
        let cur: any = target;
        for (const part of path) {
            if (cur === undefined || cur === null) return undefined;
            if (typeof part === 'number') {
                if (!Array.isArray(cur)) return undefined;
                cur = cur[part];
            } else {
                if (typeof cur !== 'object') return undefined;
                cur = cur[part];
            }
        }
        return cur;
    }

    private static deleteByPath(target: Record<string, unknown>, path: (string | number)[]): boolean {
        if (path.length === 0) return false;
        const parentPath = path.slice(0, -1);
        const key = path[path.length - 1];
        const parent = parentPath.length === 0 ? target : this.getByPath(target, parentPath);
        if (parent === undefined || parent === null) return false;
        if (typeof key === 'number' && Array.isArray(parent)) {
            if (key < 0 || key >= parent.length) return false;
            parent.splice(key, 1);
            return true;
        }
        if (typeof parent === 'object' && key in (parent as Record<string, unknown>)) {
            delete (parent as Record<string, unknown>)[key as string];
            return true;
        }
        return false;
    }

    private static setByPath(target: Record<string, unknown>, path: (string | number)[], value: unknown): boolean {
        if (path.length === 0) return false;
        let cur: any = target;
        for (let i = 0; i < path.length - 1; i++) {
            const part = path[i];
            if (typeof part === 'number') {
                if (!Array.isArray(cur)) return false;
                cur[part] ??= {};
                cur = cur[part];
            } else {
                if (typeof cur !== 'object' || cur === null) return false;
                cur[part] ??= {};
                cur = cur[part];
            }
        }
        const last = path[path.length - 1];
        if (typeof last === 'number') {
            if (!Array.isArray(cur)) return false;
            cur[last] = value;
            return true;
        }
        if (typeof cur !== 'object' || cur === null) return false;
        cur[last] = value;
        return true;
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
                rawVal = rawVal.slice(1, -1).trim();
                // Empty array case: [] becomes empty array, not [undefined]
                if (rawVal.length === 0) {
                    value = [];
                } else {
                    value = rawVal.split(',').map(v => this.parseValue(v));
                }
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
