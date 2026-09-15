import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

@Injectable({ providedIn: "root" })
export class DefaultConfig {
  read(): Promise<string> {
    return invoke<string>("get_default_config");
  }
}
