import type { TerminalIpcMessage } from "@cogno/shared/domain";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export const CognoMessageListener = {
  register(listener: (message: TerminalIpcMessage) => void): Promise<UnlistenFn> {
    return listen<TerminalIpcMessage>("cogno-message", ({ payload }) => {
      listener(payload);
    });
  },
};
