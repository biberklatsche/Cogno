import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Listens for `event` as this window hears it: what the app sends to this
 * window, or to every window. A plain `listen` also hears what is sent to
 * any other window.
 */
export function listenInThisWindow<T>(
  event: string,
  listener: (payload: T) => void,
): Promise<() => void> {
  return getCurrentWebviewWindow().listen<T>(event, ({ payload }) => listener(payload));
}
