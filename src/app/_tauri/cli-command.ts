import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {CliCommandType} from "../cli-command/cli-command.service";

/**
 * Registriert einen Listener auf das Tauri-Event "cli-command" und loggt den Befehl.
 * Gibt eine Funktion zurück, mit der der Listener wieder entfernt werden kann.
 */
export const CliCommandListener = {
    register(listener: (command: CliCommandType) => void): Promise<UnlistenFn> {
        return listen<CliCommandType>('cli-command', ({ payload }) => {
            listener(payload);
        });
    }
}
