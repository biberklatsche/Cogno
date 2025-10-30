import {Config, ConfigSchema} from "../+models/config";

/**
 * Reader-Klasse für das Einlesen/Validieren der Konfiguration.
 * Derzeit delegiert sie an die bestehende ConfigCodec-Implementierung,
 * sodass bestehende Funktionalität erhalten bleibt, während eine klare
 * Aufteilung der Verantwortlichkeiten bereitgestellt wird.
 */
export class ConfigReader {
  /** Parst zwei Konfigurationsstrings (Defaults und User) und gibt eine validierte, gemergte Config zurück. */
  static fromStringToConfig(defaultConfigString: string, userConfigString: string): Config;
  /** Rückwärtskompatibel: Wenn nur ein String übergeben wird, wird er als User-Config interpretiert (ohne Defaults). */
  static fromStringToConfig(userConfigStringOnly: string): Config;
  static fromStringToConfig(a: string, b?: string): Config {
      const defaultConfigString = b === undefined ? "" : a;
      const userConfigString = b === undefined ? a : b;
      const userConfig = this.parseConfigString(userConfigString || "");
      const defaultConfig = this.parseConfigString(defaultConfigString || "");
      return this.toConfig(defaultConfig, userConfig);
  }

    /** Führt die Default-Werte mit den User-Overrides zusammen und validiert.
     *  Regel: Alle Keys werden ersetzt (User überschreibt Default), außer 'keybind': dort werden Arrays
     *  zusammengeführt: zuerst Default-Einträge, dann User-Einträge. Andere Arrays werden ersetzt.
     */
    private static toConfig(defaultConfig: Record<string, unknown>, userConfig: Record<string, unknown>): Config {
        const merge = (defs: any, usr: any): any => {
            // Wenn User nicht gesetzt: nimm Defaults komplett
            if (usr === undefined) return this.clone(defs);
            // Wenn einer von beiden kein Plain-Object ist (oder Array), ersetze vollständig durch User
            if (Array.isArray(usr)) {
                return usr;
            }
            if (Array.isArray(defs)) {
                // Wenn User kein Array, ersetze ebenfalls mit User (Schema-Validierung kümmert sich später)
                return usr;
            }
            if (!this.isPlainObject(usr) || !this.isPlainObject(defs)) {
                return usr;
            }
            // Beide sind Plain-Objects: tief mergen
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
        return ConfigSchema.parse(merged);
    }

    private static isPlainObject(v: unknown): v is Record<string, unknown> {
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }

    private static clone<T>(v: T): T {
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
                // Special case: ensure shell.<n> object also carries its id
                if (p === 'shell' && parts.length > 0) {
                    const next = parts[0];
                    if (/^\d+$/.test(next)) {
                        cur[p] ??= {};
                        cur = cur[p];
                        cur[next] ??= {};
                        // inject id on the shell entry
                        if (typeof cur[next] === 'object' && cur[next] !== null && (cur[next] as any).id == null) {
                            (cur[next] as any).id = next;
                        }
                        // consume the numeric segment so it won't be processed again
                        parts.shift();
                        // advance into the numeric child and continue
                        cur = cur[next];
                        continue;
                    }
                }
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

    private static parseValue(rawVal: string): boolean | number | string {
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
