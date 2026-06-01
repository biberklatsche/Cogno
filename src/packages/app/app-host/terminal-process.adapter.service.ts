import { Injectable } from "@angular/core";
import { TauriPty } from "@cogno/app-tauri/pty";
import { TerminalProcessPort } from "@cogno/core-api";

@Injectable({ providedIn: "root" })
export class TerminalProcessAdapterService extends TerminalProcessPort {
  async getDescendantProcessNames(terminalId: string): Promise<ReadonlySet<string>> {
    const snapshot = await TauriPty.getProcessTreeByTerminalId(terminalId);
    return new Set(snapshot.descendants.map((p) => p.name.toLowerCase()));
  }
}
