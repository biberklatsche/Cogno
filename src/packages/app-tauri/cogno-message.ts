import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { CognoMessage } from "@cogno/app/cogno-message/cogno-message.models";

export const CognoMessageListener = {
  register(listener: (message: CognoMessage) => void): Promise<UnlistenFn> {
    return listen<CognoMessage>("cogno-message", ({ payload }) => {
      listener(payload);
    });
  },
};
