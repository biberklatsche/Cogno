import {Config, ConfigSchema} from "../+models/config";

/**
 * Reader-Klasse für das Einlesen/Validieren der Konfiguration.
 * Derzeit delegiert sie an die bestehende ConfigCodec-Implementierung,
 * sodass bestehende Funktionalität erhalten bleibt, während eine klare
 * Aufteilung der Verantwortlichkeiten bereitgestellt wird.
 */
export class ConfigReader {
  /** Parst einen Konfigurationsstring und gibt eine validierte Config zurück. */
  static fromStringToConfig(defaultConfigString :string, userConfigString: string): Config {
      const userConfig = this.parseUserString(userConfigString);
      const defaultConfig = this.parseUserString(defaultConfigString);
      return this.toConfig(defaultConfig, userConfig);
  }

    /** Führt die User-Overrides mit den Zod-Defaults zusammen und validiert. */
    private static toConfig(defaultConfig: Record<string, unknown>, userConfig: Record<string, unknown>): Config {
        // Special case: keybind array should be concatenated with defaults (defaults first, then user values)
        // All other arrays replace defaults completely
        if(userConfig['keybind'] && !Array.isArray(userConfig['keybind'])){
            userConfig['keybind'] = [userConfig['keybind']];
        }
        if (userConfig['keybind'] && Array.isArray(userConfig['keybind'])) {
            const defaultKeybinds = defaultConfig.keybind;
            const userKeybinds = userConfig['keybind'];
            userConfig['keybind'] = [...defaultKeybinds, ...userKeybinds];
        }
        // Trick: Zod-Defaults füllen alles auf; wir brauchen kein deep-merge.
        return ConfigSchema.parse(userConfig);
    }

    /** Liest einen User-Settings-String (key=value, Dot-Pfade) in ein verschachteltes Objekt ein. */
    private static parseUserString(input: string): Record<string, unknown> {
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
