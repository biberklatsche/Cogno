import { listen, UnlistenFn } from '@tauri-apps/api/event';

/**
 * Registriert einen Listener auf das Tauri-Event "cli-command" und loggt den Befehl.
 * Gibt eine Funktion zurück, mit der der Listener wieder entfernt werden kann.
 */
export const CliActionListener = {
    register(listener: (command: string) => void): Promise<UnlistenFn> {
        return listen<string>('cli-action', ({ payload }) => {
            listener(payload);
        });
    }
}
