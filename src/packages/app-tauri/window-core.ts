import { invoke } from "@tauri-apps/api/core";

export const WindowCore = {
  newWindow(): Promise<void> {
    return invoke("new_window");
  },
};
