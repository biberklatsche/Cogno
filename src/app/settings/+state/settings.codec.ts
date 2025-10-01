import {DEFAULT_SETTINGS, Settings, SettingsSchema} from "../+models/settings";

/**
 * SettingsCodec
 * - parseUserString -> Partial-Objekt aus "dot-properties"-Text
 * - toConfig        -> validiertes Config-Objekt (Defaults via Zod)
 * - diffToString    -> schreibt NUR Unterschiede ggü. Defaults zurück ("dot-properties")
 */
export class SettingsCodec {
    /** Liest einen User-Settings-String (key=value, Dot-Pfade) in ein verschachteltes Objekt ein. */
    private static parseUserString(input: string): Record<string, unknown> {
        const out: Record<string, unknown> = {};

        for (const rawLine of input.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#") || line.startsWith(";")) continue;

            const eq = line.indexOf("=");
            if (eq === -1) continue;

            const key = line.slice(0, eq).trim();
            const rawVal = line.slice(eq + 1).trim();

            let value: unknown = rawVal;

            // Quoted strings: unwrap first (so "false" stays a string, not boolean)
            const isDq = rawVal.length >= 2 && rawVal.startsWith('"') && rawVal.endsWith('"');
            const isSq = rawVal.length >= 2 && rawVal.startsWith("'") && rawVal.endsWith("'");
            if (isDq) {
                try {
                    // JSON.parse handles escape sequences for double-quoted strings
                    value = JSON.parse(rawVal);
                } catch {
                    value = rawVal.slice(1, -1);
                }
            } else if (isSq) {
                // For single quotes, just strip the outer quotes
                value = rawVal.slice(1, -1);
            } else if (/^-?\d+$/.test(rawVal) || /^-?\d+\.\d+$/.test(rawVal)) {
                // Primitive Heuristiken: number
                value = Number(rawVal);
            } else if (rawVal === "true") {
                value = true;
            } else if (rawVal === "false") {
                value = false;
            } else if (
                (rawVal.startsWith("[") && rawVal.endsWith("]")) ||
                (rawVal.startsWith("{") && rawVal.endsWith("}"))
            ) {
                // Arrays/Objects via JSON
                try { value = JSON.parse(rawVal); } catch { /* fällt auf string zurück */ }
            }

            // Dot-Pfad eintragen
            const parts = key.split(".");
            let cur: any = out;
            while (parts.length > 1) {
                const p = parts.shift()!;
                cur[p] ??= {};
                cur = cur[p];
            }
            cur[parts[0]] = value;
        }
        return out;
    }

    /** Führt die User-Overrides mit den Zod-Defaults zusammen und validiert. */
    private static toSettings(userOverrides: Record<string, unknown>): Settings {
        // Trick: Zod-Defaults füllen alles auf; wir brauchen kein deep-merge.
        return SettingsSchema.parse(userOverrides);
    }

    /** Einmal bequem: direkt von String -> fertige Config. */
    static fromStringToSettings(input: string): Settings {
        const partial = this.parseUserString(input);
        return this.toSettings(partial);
    }

    /** Erzeugt nur die Abweichungen (Diff) zwischen Defaults und aktueller Config als "dot-properties"-Text. */
    static diffToString(settings: Settings): string {
        const diff = this.diffObjects(DEFAULT_SETTINGS, settings);
        return this.toDotString(diff);
    }

    /** Erzeugt nur die Abweichungen (Diff) zwischen Defaults und aktueller Config als "dot-properties"-Text. */
    static toDotString(settings: Settings): string {
        const lines = this.toDotProperties(settings);
        // Optionale Sortierung für stabile Ausgaben
        return lines.sort((a, b) => a.localeCompare(b)).join("\n") + (lines.length ? "\n" : "");
    }

    // ---------- Helper ----------

    private static isPlainObject(v: unknown): v is Record<string, unknown> {
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }

    /** Berechnet rekursiv nur die Keys, deren Werte sich vom Default unterscheiden. */
    private static diffObjects(defs: any, cur: any): any {
        const out: any = {};
        for (const key of Object.keys(cur)) {
            const d = (defs ?? {})[key];
            const a = cur[key];

            if (this.isPlainObject(d) && this.isPlainObject(a)) {
                const child = this.diffObjects(d, a);
                if (Object.keys(child).length) out[key] = child;
            } else if (Array.isArray(d) && Array.isArray(a)) {
                if (JSON.stringify(d) !== JSON.stringify(a)) out[key] = a;
            } else if (d !== a) {
                out[key] = a;
            }
        }
        return out;
    }

    /** Wandelt ein verschachteltes Objekt in dot-properties-Zeilen um. */
    private static toDotProperties(obj: any, prefix = ""): string[] {
        const lines: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (this.isPlainObject(v)) {
                lines.push(...this.toDotProperties(v, key));
            } else {
                // Strings & komplexe Typen mit JSON serialisieren (liefert auch gültige Arrays/Objekte)
                lines.push(`${key}=${JSON.stringify(v)}`);
            }
        }
        return lines;
    }
}