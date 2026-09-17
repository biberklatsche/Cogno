import { invoke } from "@tauri-apps/api/core";

export const KeyboardLayout = {
  /**
   * The id of the active keyboard layout in the form the OS names it: the KLID
   * on Windows ("00000407"), the xkb layout on Linux ("de"), the input source
   * id on macOS ("com.apple.keylayout.German"). `null` when it cannot be read.
   */
  load(): Promise<string | null> {
    return invoke<string | null>("get_keyboard_layout");
  },
};
