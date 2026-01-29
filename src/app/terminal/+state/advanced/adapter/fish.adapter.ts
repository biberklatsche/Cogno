import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class FishAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read("Fish");

        // Normalize line endings (CRLF -> LF)
        const body = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // Encode as Base64
        const b64 = btoa(body);

        // Fish doesn't use eval the same way as bash/zsh
        // We pipe the decoded base64 to 'source' which reads from stdin
        // The space at the beginning helps avoid history logging
        return ` echo ${b64} | base64 -d | source; clear`;
    }

    pathInjection(path: string): string {
        // Fish uses 'set' instead of 'export' and different PATH syntax
        // -g for global, -x for export, -p for prepend
        return ` set -gx PATH "${path}" $PATH; clear;`;
    }
}
