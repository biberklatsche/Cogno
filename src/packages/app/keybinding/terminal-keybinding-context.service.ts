import { Injectable } from "@angular/core";
import { AppBus } from "../app-bus/app-bus";
import { TerminalId } from "../grid-list/+model/model";
import { TerminalFullscreenService } from "../terminal/terminal-fullscreen.service";

@Injectable({
  providedIn: "root",
})
export class TerminalKeybindingContextService {
  private selectedTerminalId?: TerminalId;
  private focusedTerminalId?: TerminalId;

  constructor(
    private readonly bus: AppBus,
    private readonly terminalFullscreenService: TerminalFullscreenService,
  ) {
    this.bus.onType$("FocusTerminal", { path: ["app", "terminal"] }).subscribe((event) => {
      this.selectedTerminalId = event.payload;
    });

    this.bus.onType$("TerminalFocused").subscribe((event) => {
      this.focusedTerminalId = event.payload;
    });

    this.bus.onType$("TerminalBlurred").subscribe((event) => {
      if (this.focusedTerminalId === event.payload) {
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
