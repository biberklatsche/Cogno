import { check, type Update } from "@tauri-apps/plugin-updater";

export type { Update };

export const Updater = {
  async check(): Promise<Update | null> {
    return await check();
  },

  async downloadAndInstall(update: Update): Promise<void> {
    await update.downloadAndInstall();
  },
};
