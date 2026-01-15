import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class ZshAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read("ZSH");

        // Normalize line endings (CRLF -> LF)
        const body = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // If the first line is a shebang, drop it (optional but sensible)
        const lines = body.split("\n");
        const cleanedBody =
            lines.length > 0 && lines[0].startsWith("#!") ? lines.slice(1).join("\n") : body;

        // Pick a delimiter that is guaranteed not to appear as a standalone line
        // (simple approach with a rare token + timestamp)
        const delimiter = `COGNO_ZSH_EOF_${Date.now().toString(36)}`;

        // One command (paste & run) that executes in the CURRENT zsh session:
        // - quoted delimiter (<<'EOF') prevents the outer shell from expanding anything
        // - source /dev/stdin ensures variables/functions affect the current session
        return `source /dev/stdin <<'${delimiter}'
${cleanedBody}
${delimiter}
[[ -t 1 ]] && clear`;
    }
}
