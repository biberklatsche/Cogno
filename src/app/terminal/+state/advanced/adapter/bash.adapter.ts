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

        // Encode as Base64
        const b64 = btoa(cleanedBody);

        // One-liner with leading space to avoid history
        return ` eval "$(echo ${b64} | base64 -d)"; clear`;
    }

    pathInjection(path: string): string {
        return ` export PATH="${path}:$PATH"; clear;`;
    }
}
