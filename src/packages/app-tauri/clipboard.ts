import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

export const Clipboard = {
  async writeText(text: string) {
    return await writeText(text);
  },

  async readText(): Promise<string> {
    return await readText();
  },
};
