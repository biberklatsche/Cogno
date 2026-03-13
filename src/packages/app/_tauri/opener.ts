import { openPath as tauriOpenPath, openUrl as tauriOpenUrl} from '@tauri-apps/plugin-opener';

export const Opener = {

  openPath(path: string): Promise<void> {
    return tauriOpenPath(path);
  },

  openUrl(url: string): Promise<void> {
    return tauriOpenUrl(url);
  },
};
