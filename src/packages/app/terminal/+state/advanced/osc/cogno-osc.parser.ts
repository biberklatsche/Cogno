const OscParser = {

    parse(input: string): Record<string, string> | undefined {

        if(!input) return undefined;

        const prefix = "COGNO:PROMPT;";
        const s = input.startsWith(prefix) ? input.slice(prefix.length) : input;

        // split by unescaped ';'
        const parts = splitUnescaped(s, ";");

        const out: Record<string, string> = Object.create(null);

        for (const part of parts) {
            if (!part) continue;

            const eq = indexOfUnescaped(part, "=");
            if (eq === -1) continue;

            const key = part.slice(0, eq).trim();
            if (!key) continue;

            const rawVal = part.slice(eq + 1);
            out[key] = decodeValue(rawVal);
        }
        return out;
    }
};

export default OscParser;

function splitUnescaped(s: string, delimiter: string): string[] {
    const res: string[] = [];
    let cur = "";
    let escaped = false;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (escaped) {
            cur += ch;
            escaped = false;
            continue;
        }

        if (ch === "\\") {
            // Lookahead: Is this a Windows drive path?
            // Check if cur ends with "X:" (e.g., "C:", "D:")
            if (/[A-Za-z]:$/.test(cur) && i + 1 < s.length) {
                const nextCh = s[i + 1];
                // If the \ is followed by a delimiter or the end, it's a Windows path
                if (nextCh === delimiter || i + 1 === s.length - 1) {
                    cur += ch; // Add backslash as part of the path
                    continue;
                }
            }

            cur += ch;
            escaped = true;
            continue;
        }

        if (ch === delimiter) {
            res.push(cur);
            cur = "";
            continue;
        }

        cur += ch;
    }

    res.push(cur);
    return res;
}

function indexOfUnescaped(s: string, needle: string): number {
    let escaped = false;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === "\\") {
            escaped = true;
            continue;
        }
        if (ch === needle) return i;
    }

    return -1;
}

/**
 * Matches your zsh sanitization:
 * - "\\n" -> "\n"
 * - "\;"  -> ";"
 * - "\="  -> "="
 * - "\|"  -> "|"
 * - "\\\\"-> "\\"
 */
function decodeValue(v: string): string {
    return v
        .replace(/\\n/g, "\n")
        .replace(/\\;/g, ";")
        .replace(/\\=/g, "=")
        .replace(/\\\|/g, "|")
        .replace(/\\\\/g, "\\");
}


