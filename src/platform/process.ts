import { Injectable } from "@angular/core";
import { exit as tauri_exit } from "@tauri-apps/plugin-process";

@Injectable({ providedIn: "root" })
export class Process {
  async exit(code: number = 0): Promise<void> {
    await tauri_exit(code);
  }
}
