import type { CognoMessage } from "@cogno/app/cogno-message/cogno-message.models";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export const CognoMessageListener = {
  register(listener: (message: CognoMessage) => void): Promise<UnlistenFn> {
    return listen<CognoMessage>("cogno-message", ({ payload }) => {
      listener(payload);
    });
  },
};
