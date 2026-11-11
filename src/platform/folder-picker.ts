import { Injectable } from "@angular/core";
import { open } from "@tauri-apps/plugin-dialog";

/** The operating system's dialog to choose a folder. */
@Injectable({ providedIn: "root" })
export class FolderPicker {
  /** The chosen folder, or null when the person cancelled. */
  async pick(defaultPath?: string): Promise<string | null> {
    const picked = await open({ directory: true, multiple: false, defaultPath });
    return typeof picked === "string" ? picked : null;
  }
}
