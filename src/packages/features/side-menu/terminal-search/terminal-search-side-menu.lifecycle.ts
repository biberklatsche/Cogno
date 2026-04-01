import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { TerminalSearchService } from "./terminal-search.service";
import { focusSideMenuAutofocusElement } from "../focus-side-menu-autofocus-element";

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
        focusSideMenuAutofocusElement();
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
        focusSideMenuAutofocusElement();
      },
      onBlur: () => sideMenuFeatureHandle.unregisterKeybindListener(),
    };
  }
}



