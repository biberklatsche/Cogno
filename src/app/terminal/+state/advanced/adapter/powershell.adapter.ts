import {Adapter} from './adapter';
import {Script} from '../../../../_tauri/script';

export class PowerShellAdapter implements Adapter {
    async injectionScript(): Promise<string> {
        const script = await Script.read('PowerShell');
        // Split the script into lines
        const lines = script.split(/\r?\n/);

        // Process each line
        const processedLines = lines
            .map(line => {
                // Remove comments (anything after '#')
                const commentIndex = line.indexOf('#');
                if (commentIndex !== -1) {
                    line = line.substring(0, commentIndex);
                }
                // Trim whitespace
                return line.trim();
            })
            .filter(line => line.length > 0); // Remove empty lines

        // Join the lines with semicolons
        return processedLines.join('; ') + 'Clear-Host;';
    }
}
