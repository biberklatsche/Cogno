import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { CommandPaletteService } from "./command-palette.service";

@Injectable({ providedIn: "root" })
export class CommandPaletteSideMenuLifecycle {
  constructor(private readonly commandPaletteService: CommandPaletteService) {}

  create(sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>): SideMenuFeatureLifecycleContract {
    return {
      onModeChange: (mode) => {
        if (mode === "off") {
          this.commandPaletteService.handleSideMenuClose();
        }
      },
      onOpen: () => {
        this.commandPaletteService.handleSideMenuOpen();
        this.focusSideMenuAutofocusElement();
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
              this.commandPaletteService.fireSelectedAction();
              sideMenuFeatureHandle.close();
              return;
            }
            this.commandPaletteService.handleNavigationKey(keyboardEvent.key);
          },
        );
        this.focusSideMenuAutofocusElement();
      },
      onBlur: () => sideMenuFeatureHandle.unregisterKeybindListener(),
    };
  }

  private focusSideMenuAutofocusElement(): void {
    const scheduleFocus = globalThis.requestAnimationFrame ?? ((callback: FrameRequestCallback) => setTimeout(callback, 0));
    scheduleFocus(() => {
      const documentReference = globalThis.document;
      if (!documentReference) {
        return;
      }
      const autofocusElement = documentReference.querySelector<HTMLInputElement>("[data-side-menu-autofocus='true']");
      autofocusElement?.focus();
      autofocusElement?.select();
    });
  }
}



