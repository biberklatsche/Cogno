import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

@Injectable({ providedIn: "root" })
export class CliConfigOverrides {
  getSerializedOverrides(): Promise<string | null> {
    return invoke<string | null>("get_cli_config_set_overrides");
  }
}
