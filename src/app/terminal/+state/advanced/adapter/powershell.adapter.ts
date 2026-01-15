import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class PowerShellAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read("PowerShell");

        // Normalize line endings
        const body = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        // Encode as UTF-16LE Base64 (PowerShell "Unicode")
        const b64 = this.toBase64Utf16LE(body);

        // One-liner, runs in CURRENT PowerShell session
        return `$__c='${b64}'; iex ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($__c))); Clear-Host`;
    }

    private toBase64Utf16LE(input: string): string {
        let binary = "";
        for (let i = 0; i < input.length; i++) {
            const code = input.charCodeAt(i);
            // little endian: low byte first
            binary += String.fromCharCode(code & 0xff, code >> 8);
        }
        // btoa ist in Browsern, Deno, Bun verfügbar
        return btoa(binary);
    }
}

