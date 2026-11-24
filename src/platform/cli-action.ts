import { Injectable } from "@angular/core";
import { UnlistenFn } from "@tauri-apps/api/event";
import { listenInThisWindow } from "./window-events";

/**
 * What a second `cogno` start handed to the running instance: an action to
 * run, or a notice about what it could not take on. Each returns a function
 * that removes the listener.
 */
@Injectable({ providedIn: "root" })
export class CliActionListener {
  register(listener: (command: string) => void): Promise<UnlistenFn> {
    return listenInThisWindow<string>("cli-action", listener);
  }

  registerNotice(listener: (notice: string) => void): Promise<UnlistenFn> {
    return listenInThisWindow<string>("cli-notice", listener);
  }
}
