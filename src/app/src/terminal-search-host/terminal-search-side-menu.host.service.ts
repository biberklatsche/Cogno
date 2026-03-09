import { DestroyRef, Injectable } from "@angular/core";
import { SideMenuFeature } from "../menu/side-menu/+state/side-menu-feature";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";
import { KeybindService } from "../keybinding/keybind.service";
import { createSideMenuFeature } from "../menu/side-menu/+state/side-menu-feature";
import { CoreHostWiringService } from "../core-host/core-host-wiring.service";
import { TerminalSearchService } from "@cogno/open-features/terminal-search/terminal-search.service";
import { terminalSearchFeatureId } from "@cogno/open-features/terminal-search/terminal-search.feature-definition";

@Injectable({ providedIn: "root" })
export class TerminalSearchSideMenuHostService {
  private readonly sideMenuFeature: SideMenuFeature;

  constructor(
    private readonly sideMenuService: SideMenuService,
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
    private readonly keybindService: KeybindService,
    private readonly destroyRef: DestroyRef,
    private readonly terminalSearchService: TerminalSearchService,
  ) {
    const terminalSearchSideMenuFeatureDefinition = CoreHostWiringService
      .getInstance()
      .getRequiredSideMenuFeatureDefinitionById(terminalSearchFeatureId);

    this.sideMenuFeature = createSideMenuFeature(
      terminalSearchSideMenuFeatureDefinition,
      {
        onModeChange: (mode) => {
          if (mode === "off") {
            this.terminalSearchService.handleSideMenuClose();
          }
        },
        onOpen: () => this.terminalSearchService.handleSideMenuOpen(),
        onClose: () => this.terminalSearchService.handleSideMenuClose(),
        onFocus: () => this.registerKeybindListener(),
        onBlur: () => this.unregisterKeybindListener(),
      },
      {
        sideMenuService: this.sideMenuService,
        bus: this.appBus,
        configService: this.configService,
        keybinds: this.keybindService,
        destroyRef: this.destroyRef,
      },
    );

    void this.sideMenuFeature;
  }

  private registerKeybindListener(): void {
    this.sideMenuFeature.registerKeybindListener(["Escape", "Enter"], (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        this.sideMenuFeature.close();
        return;
      }
      if (keyboardEvent.key === "Enter") {
        this.terminalSearchService.repeatSearch();
      }
    });
  }

  private unregisterKeybindListener(): void {
    this.sideMenuFeature.unregisterKeybindListener();
  }
}
