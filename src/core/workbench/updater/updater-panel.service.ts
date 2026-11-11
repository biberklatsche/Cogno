import { effect, Injectable, Injector } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { UpdaterService } from "./updater.service";
import { UpdaterSideComponent } from "./updater-side.component";

export const UPDATER_PANEL_LABEL = "About Cogno";

/**
 * The updater's place in the workbench: the About Cogno entry at the bottom of
 * the side menu, next to the settings, and the `open_about` action. The panel
 * says what Cogno is, which version runs and whether a newer one waits.
 * Keeping Cogno current is the application's own business, not a feature, so
 * it is always on: checks start with the window and the dot on the entry says
 * a new version waits, even while the panel is closed.
 */
@Injectable({ providedIn: "root" })
export class UpdaterPanelService {
  constructor(
    sideMenu: SideMenuService,
    actions: ActionHandlers,
    updater: UpdaterService,
    injector: Injector,
  ) {
    sideMenu.addMenuItem({
      id: "updater",
      label: UPDATER_PANEL_LABEL,
      icon: "mdiInformation",
      bottom: true,
      order: 10,
      actionName: "open_about",
      component: UpdaterSideComponent,
    });
    actions.handle("open_about", () => sideMenu.toggle(UPDATER_PANEL_LABEL));
    updater.start();
    effect(
      () => {
        const phase = updater.state()?.phase;
        sideMenu.updateBadgeColor(
          UPDATER_PANEL_LABEL,
          phase === "available" || phase === "ready" ? "var(--highlight-color)" : undefined,
        );
      },
      { injector },
    );
  }
}
