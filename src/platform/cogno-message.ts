import { Injectable } from "@angular/core";
import type { TerminalIpcMessage } from "@cogno/shared/domain";
import { UnlistenFn } from "@tauri-apps/api/event";
import { listenInThisWindow } from "./window-events";

@Injectable({ providedIn: "root" })
export class CognoMessageListener {
  register(listener: (message: TerminalIpcMessage) => void): Promise<UnlistenFn> {
    return listenInThisWindow<TerminalIpcMessage>("cogno-message", listener);
  }
}
