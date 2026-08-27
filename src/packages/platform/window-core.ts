import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

@Injectable({ providedIn: "root" })
export class WindowCore {
  newWindow(): Promise<void> {
    return invoke("new_window");
  }
}
