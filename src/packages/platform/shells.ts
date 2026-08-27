import { Injectable } from "@angular/core";
import { ShellTypeContract } from "@cogno/shared/domain";
import { invoke } from "@tauri-apps/api/core";

export type Shell = { name: string; path: string; shell_type: ShellTypeContract };

@Injectable({ providedIn: "root" })
export class Shells {
  load(): Promise<Shell[]> {
    return invoke<Shell[]>("list_shells");
  }
}
