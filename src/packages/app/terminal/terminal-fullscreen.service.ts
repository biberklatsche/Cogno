import { Injectable, signal } from "@angular/core";
import { AppBus } from "../app-bus/app-bus";
import { TerminalId } from "../grid-list/+model/model";

@Injectable({
  providedIn: "root",
})
export class TerminalFullscreenService {
  private readonly fullScreenTerminalIds = signal<ReadonlySet<TerminalId>>(new Set());

  constructor(private readonly bus: AppBus) {
    this.bus.onType$("FullScreenAppEntered").subscribe((event) => {
      const terminalId = event.payload;
      if (!terminalId) {
        return;
      }
      this.updateFullScreenTerminalIds((terminalIds) => {
        terminalIds.add(terminalId);
      });
    });

    this.bus.onType$("FullScreenAppLeaved").subscribe((event) => {
      const terminalId = event.payload;
      if (!terminalId) {
        return;
      }
      this.updateFullScreenTerminalIds((terminalIds) => {
        terminalIds.delete(terminalId);
      });
    });

    this.bus.onType$("TerminalRemoved", { path: ["app", "terminal"] }).subscribe((event) => {
      const terminalId = event.payload;
      if (!terminalId) {
        return;
      }
      this.updateFullScreenTerminalIds((terminalIds) => {
        terminalIds.delete(terminalId);
      });
    });
  }

  isTerminalFullScreen(terminalId: TerminalId | undefined): boolean {
    if (!terminalId) {
      return false;
    }

    return this.fullScreenTerminalIds().has(terminalId);
  }

  private updateFullScreenTerminalIds(update: (terminalIds: Set<TerminalId>) => void): void {
    const nextTerminalIds = new Set(this.fullScreenTerminalIds());
    update(nextTerminalIds);
    this.fullScreenTerminalIds.set(nextTerminalIds);
  }
}
