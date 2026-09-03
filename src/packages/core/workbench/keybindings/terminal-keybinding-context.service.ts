import { Injectable } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalFullscreenService } from "@cogno/core/workbench/terminal/terminal-fullscreen.service";
import { TerminalId } from "@cogno/shared/ports";

@Injectable({
  providedIn: "root",
})
export class TerminalKeybindingContextService {
  private selectedTerminalId?: TerminalId;
  private focusedTerminalId?: TerminalId;

  constructor(
    private readonly bus: AppBus,
    private readonly terminalFullscreenService: TerminalFullscreenService,
    sessionRegistry: TerminalSessionRegistry,
  ) {
    this.bus.onType$("FocusTerminal", { path: ["app", "terminal"] }).subscribe((event) => {
      this.selectedTerminalId = event.payload;
    });

    sessionRegistry.facts$.subscribe(({ terminalId, fact }) => {
      if (fact.type !== "focusChanged") return;
      if (fact.focused) {
        this.focusedTerminalId = terminalId;
      } else if (this.focusedTerminalId === terminalId) {
        this.focusedTerminalId = undefined;
      }
    });

    this.bus.onType$("TerminalRemoved", { path: ["app", "terminal"] }).subscribe((event) => {
      if (this.selectedTerminalId === event.payload) {
        this.selectedTerminalId = undefined;
      }
      if (this.focusedTerminalId === event.payload) {
        this.focusedTerminalId = undefined;
      }
    });
  }

  shouldSuppressAppKeybindings(): boolean {
    if (!this.focusedTerminalId || !this.selectedTerminalId) {
      return false;
    }

    if (this.focusedTerminalId !== this.selectedTerminalId) {
      return false;
    }

    return this.terminalFullscreenService.isTerminalFullScreen(this.focusedTerminalId);
  }
}
