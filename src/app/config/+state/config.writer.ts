import {Config, ConfigSchema} from "../+models/config";

/**
 * Writer-Klasse für das Generieren von Konfigurationsdatei-Inhalten.
 */
export class ConfigWriter {

    /** Erstellt die Differenz (gegen Defaults) als dot-properties-Text ohne Kommentare. */
    static diffToString(defaultConfig: Config, config: Config): string {
        const diff = this.diffObjects(defaultConfig, config);
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

    private static toDotString(settings: Config, asComments: boolean = true): string {
        const lines = this.toDotProperties(settings, "", ConfigSchema, asComments);
        return lines.join("\n") + (lines.length ? "\n" : "");
    }

    private static isPlainObject(v: unknown): v is Record<string, unknown> {
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }

    /** Rendert einen Wert als String (ohne Quotes für strings, primitives direkt). */
    private static renderValue(value: unknown): string {
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return JSON.stringify(value);
    }

    /** Fügt Schema-Beschreibung als Kommentarzeilen hinzu, falls vorhanden. */
    private static addSchemaDescription(lines: string[], schema: any): void {
        const desc = this.getSchemaDescription(schema);
        if (desc) {
            for (const line of String(desc).split(/\r?\n/)) {
                lines.push(`# ${line.trim()}`);
            }
        }
    }

    /** Wandelt ein verschachteltes Objekt in dot-properties-Zeilen um und schreibt Zod-Descriptions als Kommentare (#). */
    private static toDotProperties(obj: any, prefix = "", schema?: any, asComment: boolean = true): string[] {
        const lines: string[] = [];

        for (const k of Object.keys(obj).sort()) {
            const v = (obj as any)[k];
            const key = prefix ? `${prefix}.${k}` : k;
            const childSchema = this.getChildSchema(schema, k);
            const commentPrefix = asComment ? '# ' : '';

            if (this.isPlainObject(v)) {
                const unwrapped = this.unwrapSchema(childSchema);
                lines.push(...this.toDotProperties(v, key, unwrapped, asComment));
            } else if (Array.isArray(v)) {
                if (asComment) {
                    this.addSchemaDescription(lines, childSchema);
                }

                if (key === 'keybind') {
                    // Keybinds werden mehrzeilig ausgegeben
                    for (const item of v) {
                        lines.push(`${commentPrefix}${key}=${this.renderValue(item)}`);
                    }
                } else {
                    // Andere Arrays als kommagetrennte Liste
                    const items = v.map(item => this.renderValue(item));
                    lines.push(`${commentPrefix}${key}=[${items.join(',')}]`);
                }
            } else {
                if (asComment) {
                    this.addSchemaDescription(lines, childSchema);
                }
                lines.push(`${commentPrefix}${key}=${this.renderValue(v)}`);
            }
        }
        return lines;
    }

    private static unwrapSchema(s: any): any {
        let cur = s;
        while (cur && cur._def) {
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
        if (!parent) return undefined;

        const p = this.unwrapSchema(parent);
        const def = p?._def;
        if (!def) return undefined;

        const shape = this.extractShape(p, def);
        if (!shape) return undefined;

        if (Object.prototype.hasOwnProperty.call(shape, key)) {
            let child = (shape as any)[key];
            if (typeof child === 'function') {
                try { child = child(); } catch { /* ignore */ }
            }
            return child;
        }
        return undefined;
    }

    private static extractShape(schemaInstance: any, def: any): any {
        // Versuche zuerst die Instanz-shape
        const instShape = schemaInstance?.out?.shape;
        if (typeof instShape === 'function') return instShape.call(schemaInstance);
        if (instShape) return instShape;

        // Fallback auf _def.shape
        if (typeof def.shape === 'function') return def.shape();
        if (def.shape) return def.shape;

        return undefined;
    }

    private static getSchemaDescription(s: any): string | undefined {
        if (!s) return undefined;

        const direct = s?.description;
        if (typeof direct === 'string' && direct.length) return direct;

        const unwrapped = this.unwrapSchema(s);
        return unwrapped?.description || undefined;
    }
}
