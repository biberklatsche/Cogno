import { check, type Update } from "@tauri-apps/plugin-updater";

export type { Update };

export const Updater = {
  check(): Promise<Update | null> {
    return check();
  },

  async downloadAndInstall(update: Update): Promise<void> {
    await update.downloadAndInstall();
  },
};
