import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { focusSideMenuAutofocusElement } from "../focus-side-menu-autofocus-element";
import { CommandPaletteService } from "./command-palette.service";

@Injectable({ providedIn: "root" })
export class CommandPaletteSideMenuLifecycle {
  constructor(private readonly commandPaletteService: CommandPaletteService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onModeChange: (mode) => {
        if (mode === "off") {
          this.commandPaletteService.handleSideMenuClose();
        }
      },
      onOpen: () => {
        this.commandPaletteService.handleSideMenuOpen();
        focusSideMenuAutofocusElement();
      },
      onClose: () => this.commandPaletteService.handleSideMenuClose(),
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(
          ["Escape", "Enter", "ArrowDown", "ArrowUp"],
          (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.key === "Escape") {
              sideMenuFeatureHandle.close();
              return;
            }
            if (keyboardEvent.key === "Enter") {
              const selectedCommandEntry = this.commandPaletteService.getSelectedEntry();
              sideMenuFeatureHandle.close();
              queueMicrotask(() => {
                this.commandPaletteService.fireSelectedAction(selectedCommandEntry);
              });
              return;
            }
            this.commandPaletteService.handleNavigationKey(keyboardEvent.key);
          },
        );
        focusSideMenuAutofocusElement();
      },
      onBlur: () => sideMenuFeatureHandle.unregisterKeybindListener(),
    };
  }
}
