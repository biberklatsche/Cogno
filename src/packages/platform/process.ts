import { Injectable } from "@angular/core";
import { exit as tauri_exit, relaunch as tauri_relaunch } from "@tauri-apps/plugin-process";

@Injectable({ providedIn: "root" })
export class Process {
  async exit(code: number = 0): Promise<void> {
    await tauri_exit(code);
  }

  async relaunch(): Promise<void> {
    return await tauri_relaunch();
  }
}
