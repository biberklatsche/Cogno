import {Config, ConfigSchema, DEFAULT_CONFIG} from "../+models/config";

/**
 * Writer-Klasse für das Generieren von Konfigurationsdatei-Inhalten.
 * Delegiert aktuell an die bestehende ConfigCodec-Implementierung.
 */
export class ConfigWriter {
  /** Gibt die Default-Config als kommentierten dot-properties-Text (#) zurück. */
  static defaultSettingsAsComment(): string {
      return this.toDotString(DEFAULT_CONFIG, true);
  }

    /** Erstellt die Differenz (gegen Defaults) als dot-properties-Text ohne Kommentare. */
    static diffToString(config: Config): string {
        const diff = this.diffObjects(DEFAULT_CONFIG, config);
        return this.toDotString(diff, false);
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

    private  static toDotString(settings: Config, asComments: boolean = true): string {
      const lines = this.toDotProperties(settings, "", ConfigSchema, asComments);
      // Keine Sortierung mehr, um Kommentare an den zugehörigen Keys zu belassen
      return lines.join("\n") + (lines.length ? "\n" : "");
  }


    private static isPlainObject(v: unknown): v is Record<string, unknown> {
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }

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

    /** Wandelt ein verschachteltes Objekt in dot-properties-Zeilen um und schreibt Zod-Descriptions als Kommentare (#). */
    private static toDotProperties(obj: any, prefix = "", schema?: any, asComment: boolean = true): string[] {
        const lines: string[] = [];
        // Für stabile, aber vorhersehbare Ausgabe: iteriere nach Schlüsselname sortiert innerhalb derselben Ebene
        for (const k of Object.keys(obj).sort()) {
            const v = (obj as any)[k];
            const key = prefix ? `${prefix}.${k}` : k;

            const childSchema = this.getChildSchema(schema, k);

            if (this.isPlainObject(v)) {
                const unwrapped = this.unwrapSchema(childSchema);
                lines.push(...this.toDotProperties(v, key, unwrapped, asComment));
            } else if (Array.isArray(v)) {
                // Arrays werden als mehrere Zeilen ausgegeben: key=a\nkey=b ...
                // Beschreibung (falls vorhanden) als Kommentar einmalig voranstellen
                if (asComment) {
                    const desc = this.getSchemaDescription(childSchema);
                    if (desc) {
                        for (const l of String(desc).split(/\r?\n/)) {
                            lines.push(`# ${l.trim()}`);
                        }
                    }
                }
                for (const item of v) {
                    const rendered = typeof item === 'string'
                        ? item
                        : (typeof item === 'number' || typeof item === 'boolean')
                            ? String(item)
                            : JSON.stringify(item);
                    lines.push(`${asComment ? '# ' : ''}${key}=${rendered}`);
                }
            } else {
                // Beschreibung (falls vorhanden) als Kommentar ausgeben
                if (asComment) {
                    const desc = this.getSchemaDescription(childSchema);
                    if (desc) {
                        for (const l of String(desc).split(/\r?\n/)) {
                            lines.push(`# ${l.trim()}`);
                        }
                    }
                }
                // Strings unquoted, primitives as-is;
                const rendered = typeof v === 'string'
                    ? v
                    : (typeof v === 'number' || typeof v === 'boolean')
                        ? String(v)
                        : JSON.stringify(v);
                lines.push(`${asComment ? '# ' : ''}${key}=${rendered}`);
            }
        }
        return lines;
    }

    private static getChildSchema(parent: any, key: string): any {
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
