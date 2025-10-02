import {DEFAULT_SETTINGS, Settings, SettingsSchema} from "../+models/settings";

/**
 * SettingsCodec
 * - parseUserString -> Partial-Objekt aus "dot-properties"-Text
 * - toConfig        -> validiertes Config-Objekt (Defaults via Zod)
 * - diffToString    -> schreibt NUR Unterschiede ggü. Defaults zurück ("dot-properties")
 */
export class SettingsCodec {
    /** Gibt die DEFAULT_SETTINGS als dot-properties-Text mit Schema-Kommentaren (#) zurück. */
    static defaultsToStringWithComments(): string {
        return this.toDotString(DEFAULT_SETTINGS, true);
    }
    /** Liest einen User-Settings-String (key=value, Dot-Pfade) in ein verschachteltes Objekt ein. */
    private static parseUserString(input: string): Record<string, unknown> {
        const out: Record<string, unknown> = {};

        for (const rawLine of input.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#") || line.startsWith(";")) continue;

            const eq = line.indexOf("=");
            if (eq === -1) continue;

            let key = line.slice(0, eq).trim();
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
        return this.toDotString(diff, false);
    }

    /** Wandelt ein beliebiges Settings-Objekt in dot-properties-Text um. Optional mit Schema-Kommentaren. */
    static toDotString(settings: Settings, includeComments: boolean = true): string {
        const lines = this.toDotProperties(settings, "", SettingsSchema, includeComments);
        // Keine Sortierung mehr, um Kommentare an den zugehörigen Keys zu belassen
        return lines.join("\n") + (lines.length ? "\n" : "");
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

    /** Wandelt ein verschachteltes Objekt in dot-properties-Zeilen um und schreibt Zod-Descriptions als Kommentare (#). */
    private static toDotProperties(obj: any, prefix = "", schema?: any, includeComments: boolean = true): string[] {
        const lines: string[] = [];
        // Für stabile, aber vorhersehbare Ausgabe: iteriere nach Schlüsselname sortiert innerhalb derselben Ebene
        for (const k of Object.keys(obj).sort()) {
            const v = (obj as any)[k];
            const key = prefix ? `${prefix}.${k}` : k;

            const childSchema = this.getChildSchema(schema, k);

            if (this.isPlainObject(v)) {
                const unwrapped = this.unwrapSchema(childSchema);
                lines.push(...this.toDotProperties(v, key, unwrapped, includeComments));
            } else {
                // Beschreibung (falls vorhanden) als Kommentar ausgeben
                if (includeComments) {
                    if (key.endsWith('.name')) {
                        // eslint-disable-next-line no-console
                        console.log('DESC', key);
                        // eslint-disable-next-line no-console
                        console.log('CHILD', key, !!childSchema, childSchema?._def?.typeName);
                    }

                    const desc = this.getSchemaDescription(childSchema);
                    // Debug: inspect description for name fields

                    if (desc) {
                        for (const l of String(desc).split(/\r?\n/)) {
                            lines.push(`#${l}`.trimEnd());
                        }
                    }
                }
                // Strings & komplexe Typen mit JSON serialisieren (liefert auch gültige Arrays/Objekte)
                lines.push(`${key}=${JSON.stringify(v)}`);
            }
        }
        return lines;
    }

    // ----- Zod Schema Helpers -----
    private static unwrapSchema(s: any): any {
        let cur = s;
        while (cur && cur._def) {
            // Default/Optional/Nullable: innerType; Effects: schema
            if (cur._def.innerType) {
                cur = cur._def.innerType;
                continue;
            }
            if (cur._def.schema) {
                cur = cur._def.schema;
                continue;
            }
            break;
        }
        return cur;
    }

    private static getChildSchema(parent: any, key: string): any {

        if(key === 'name') {
            console.log('#####');
        }

        if (!parent) return undefined;
        const p = this.unwrapSchema(parent);
        // ZodObject: shape either function or object; try instance first, then _def
        const def = p?._def;
        if (!def) return undefined;
        let shape: any;
        const instShape = (p as any)?.out?.shape;
        if (typeof instShape === 'function') {
            shape = instShape.call(p);
        } else if (instShape) {
            shape = instShape;
        }
        if (!shape) {
            if (typeof def.shape === 'function') {
                shape = def.shape();
            } else if (def.shape) {
                shape = def.shape;
            }
        }
        if (shape) {
            if (Object.prototype.hasOwnProperty.call(shape, key)) {
                let child = (shape as any)[key];
                if (typeof child === 'function') {
                    try { child = child(); } catch { /* ignore */ }
                }
                return child;
            }
        }
        return undefined;
    }

    private static getSchemaDescription(s: any): string | undefined {
        if (!s) return undefined;
        // Prefer description on the wrapper itself (e.g., .default(...).describe(...))
        const direct = s?.description;
        if (typeof direct === 'string' && direct.length) return direct;
        const u = this.unwrapSchema(s);
        // Zod speichert die Beschreibung in _def.description
        return u?.description || undefined;
    }
}