import { Injectable, signal } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalId } from "@cogno/shared/domain";

@Injectable({
  providedIn: "root",
})
export class TerminalFullscreenService {
  private readonly fullScreenTerminalIds = signal<ReadonlySet<TerminalId>>(new Set());

  constructor(
    private readonly bus: AppBus,
    sessionRegistry: TerminalSessionRegistry,
  ) {
    sessionRegistry.facts$.subscribe(({ terminalId, fact }) => {
      if (fact.type !== "fullScreenChanged") return;
      this.updateFullScreenTerminalIds((terminalIds) => {
        if (fact.active) {
          terminalIds.add(terminalId);
        } else {
          terminalIds.delete(terminalId);
        }
      });
    });

    this.bus.on$("TerminalRemoved").subscribe((event) => {
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
