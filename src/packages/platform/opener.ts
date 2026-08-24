import { Injectable } from "@angular/core";
import { openPath as tauriOpenPath, openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";

/** Opens paths and URLs with the operating system's default handler. */
@Injectable({ providedIn: "root" })
export class Opener {
  openPath(path: string): Promise<void> {
    return tauriOpenPath(path);
  }

  openUrl(url: string): Promise<void> {
    return tauriOpenUrl(url);
  }
}
