import { getVersion } from "@tauri-apps/api/app";

export const AppInfo = {
  version(): Promise<string> {
    return getVersion();
  },
};
