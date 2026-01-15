import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class BashAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read("Bash");
        const body = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // drop shebang if present
        const lines = body.split("\n");
        const cleanedBody =
            lines.length > 0 && lines[0].startsWith("#!") ? lines.slice(1).join("\n") : body;

        // delimiter that won't collide (simple + robust enough)
        const delimiter = `COGNO_EOF_${Date.now().toString(36)}`;

        return `source /dev/stdin <<'${delimiter}'
${cleanedBody}
${delimiter}
[[ -t 1 ]] && clear`;
    }
}
