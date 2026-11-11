import { Injectable } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { SettingsNavigation } from "./settings-navigation";
import { SettingsPanelComponent } from "./settings-panel.component";

export const SETTINGS_PANEL_LABEL = "Settings";

/**
 * The settings panel's place in the workbench: the entry at the bottom of the
 * side menu and the `open_settings` action. Settings are no feature - they
 * are the workbench's own - so the entry is registered here, not through the
 * feature host, and it is always there. With a top-level key as argument
 * (`open_settings notification`) the action opens the panel at that key's
 * section instead of toggling it.
 */
@Injectable({ providedIn: "root" })
export class SettingsPanelService {
  constructor(sideMenu: SideMenuService, actions: ActionHandlers, navigation: SettingsNavigation) {
    sideMenu.addMenuItem({
      id: "settings",
      label: SETTINGS_PANEL_LABEL,
      icon: "mdiCog",
      bottom: true,
      order: 20,
      // Wide enough that the sections stand on the left from the first open on.
      defaultPanelWidthInPixels: 620,
      actionName: "open_settings",
      component: SettingsPanelComponent,
    });
    actions.handle("open_settings", ({ args }) => {
      const key = args?.[0];
      if (!key) {
        sideMenu.toggle(SETTINGS_PANEL_LABEL);
        return;
      }
      navigation.request(key);
      sideMenu.open(SETTINGS_PANEL_LABEL);
    });
  }
}
