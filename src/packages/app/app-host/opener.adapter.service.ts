import { Injectable } from "@angular/core";
import { Opener as TauriOpener } from "@cogno/app-tauri/opener";
import { OpenerContract } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class OpenerAdapterService implements OpenerContract {
  openPath(path: string): Promise<void> {
    return TauriOpener.openPath(path);
  }

  openUrl(url: string): Promise<void> {
    return TauriOpener.openUrl(url);
  }
}
