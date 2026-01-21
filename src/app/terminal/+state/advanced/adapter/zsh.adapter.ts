import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class ZshAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read("ZSH");

        // Normalize line endings (CRLF -> LF)
        const body = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // Encode as Base64
        const b64 = btoa(body);

        // One-liner, runs in CURRENT zsh session
        // We use 'source' with a temporary file-like approach to avoid 'eval' being echoed in some environments
        // or just keep it simple if eval is enough, but add a space at the beginning to avoid history logging (common shell convention)
        return ` eval "$(echo ${b64} | base64 -d)"; clear`;
    }

    pathInjection(path: string): string {
        return ` export PATH="${path}:$PATH"; clear;`;
    }
}
