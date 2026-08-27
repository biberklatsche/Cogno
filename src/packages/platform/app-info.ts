import { Injectable } from "@angular/core";
import { getVersion } from "@tauri-apps/api/app";

@Injectable({ providedIn: "root" })
export class AppInfo {
  version(): Promise<string> {
    return getVersion();
  }
}
