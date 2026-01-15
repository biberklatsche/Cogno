import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class BashAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read("Bash");

        // Normalize line endings
        const lines = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

        // Optional: drop leading shebang line
        const cleaned =
            lines.length > 0 && lines[0].startsWith("#!") ? lines.slice(1) : lines;

        // Bash-safe single-quote for each line:
        // 'foo'bar'  => 'foo'"'"'bar'
        const shQuote = (s: string) => `'${s.replace(/'/g, `'\"'\"'`)}'`;

        // Keep the script as-is (including comments/blank lines if you want).
        // If you really want to drop blank lines, do it safely:
        const finalLines = cleaned; // or: cleaned.filter(l => l.trim().length > 0)

        const args = finalLines.map(shQuote).join(" ");

        // Runs in the CURRENT bash session, no files written:
        // source <(printf '%s\n' 'line1' 'line2' ...)
        return `source <(printf '%s\\n' ${args}); clear;`;
    }
}
