import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { focusSideMenuAutofocusElement } from "../focus-side-menu-autofocus-element";
import { TerminalSearchService } from "./terminal-search.service";

@Injectable({ providedIn: "root" })
export class TerminalSearchSideMenuLifecycle {
  constructor(private readonly terminalSearchService: TerminalSearchService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
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
        sideMenuFeatureHandle.registerKeybindListener(
          ["Escape", "Enter", "ArrowDown", "ArrowUp"],
          (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.key === "Escape") {
              sideMenuFeatureHandle.close();
              return;
            }
            if (keyboardEvent.key === "Enter") {
              if (!this.terminalSearchService.revealSelectedSearchResult()) {
                this.terminalSearchService.repeatSearch();
              }
              return;
            }
            this.terminalSearchService.handleNavigationKey(keyboardEvent.key);
          },
        );
        focusSideMenuAutofocusElement();
      },
      onBlur: () => sideMenuFeatureHandle.unregisterKeybindListener(),
    };
  }
}
