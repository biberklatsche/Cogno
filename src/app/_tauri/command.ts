import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {ActionBase} from "../app-bus/app-bus";

// Halte die aktuell unterstützten Befehle hier (entsprechend Serde-String-Repräsentation)
// Hinweis: Aktuell senden wir "kebab-case" (z. B. "open-new-tab").
// Wenn du auf snake_case umstellst, passe die Union entsprechend an.
export type CommandType = 'open_new_tab' | 'close_active_tab';

export type CommandFiredEvent = ActionBase<"CommandFired", CommandType>


/**
 * Registriert einen Listener auf das Tauri-Event "cli-command" und loggt den Befehl.
 * Gibt eine Funktion zurück, mit der der Listener wieder entfernt werden kann.
 */
export const TauriCommandListener = {
    register(listener: (command: CommandType) => void): Promise<UnlistenFn> {
        return listen<CommandType>('cli-command', ({ payload }) => {
            // Einfaches Logging – hier später UI-Dispatch einbauen
            console.log('[cli-command]', payload);
            listener(payload);
        });
    }
}
