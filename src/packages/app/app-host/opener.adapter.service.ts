import { Injectable } from "@angular/core";
import { Opener as TauriOpener } from "@cogno/app-tauri/opener";
import { Opener } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class OpenerAdapterService extends Opener {
  openPath(path: string): Promise<void> {
    return TauriOpener.openPath(path);
  }

  openUrl(url: string): Promise<void> {
    return TauriOpener.openUrl(url);
  }
}
