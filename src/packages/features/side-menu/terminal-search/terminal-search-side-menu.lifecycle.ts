import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { TerminalSearchService } from "./terminal-search.service";

@Injectable({ providedIn: "root" })
export class TerminalSearchSideMenuLifecycle {
  constructor(private readonly terminalSearchService: TerminalSearchService) {}

  create(sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>): SideMenuFeatureLifecycleContract {
    return {
      onModeChange: (mode) => {
        if (mode === "off") {
          this.terminalSearchService.handleSideMenuClose();
        }
      },
      onOpen: () => {
        this.terminalSearchService.handleSideMenuOpen();
        this.focusSideMenuAutofocusElement();
      },
      onClose: () => this.terminalSearchService.handleSideMenuClose(),
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape", "Enter"], (keyboardEvent: KeyboardEvent) => {
          if (keyboardEvent.key === "Escape") {
            sideMenuFeatureHandle.close();
            return;
          }
          if (keyboardEvent.key === "Enter") {
            this.terminalSearchService.repeatSearch();
          }
        });
        this.focusSideMenuAutofocusElement();
      },
      onBlur: () => sideMenuFeatureHandle.unregisterKeybindListener(),
    };
  }

  private focusSideMenuAutofocusElement(): void {
    const scheduleFocus = globalThis.requestAnimationFrame ?? ((callback: FrameRequestCallback) => setTimeout(callback, 0));
    scheduleFocus(() => {
      const autofocusElement = this.findSideMenuAutofocusElement();
      autofocusElement?.focus();
      autofocusElement?.select();
    });
  }

  private findSideMenuAutofocusElement(): HTMLInputElement | null {
    const documentReference = globalThis.document;
    if (!documentReference) {
      return null;
    }
    return documentReference.querySelector<HTMLInputElement>("[data-side-menu-autofocus='true']");
  }
}



