import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * Registers a listener for the Tauri event "cli-command" and logs the command.
 * Returns a function that can be used to remove the listener.
 */
export const CliActionListener = {
  register(listener: (command: string) => void): Promise<UnlistenFn> {
    return listen<string>("cli-action", ({ payload }) => {
      listener(payload);
    });
  },
};
