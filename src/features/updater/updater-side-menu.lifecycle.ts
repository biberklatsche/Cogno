import { EffectRef, effect, Injectable, Injector } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core/api/contributions";
import { UpdaterService } from "./updater.service";

@Injectable({ providedIn: "root" })
export class UpdaterSideMenuLifecycle {
  constructor(private readonly updaterService: UpdaterService) {}

  create(
    injector: Injector,
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    let badgeEffect: EffectRef | undefined;

    return {
      onModeChange: (mode) => {
        badgeEffect?.destroy();
        badgeEffect = undefined;
        if (mode !== "on") {
          this.updaterService.stop();
          sideMenuFeatureHandle.updateBadgeColor(undefined);
          return;
        }
        this.updaterService.start();
        // The dot says a new version waits for the user, even while the panel is closed.
        badgeEffect = effect(
          () => {
            const phase = this.updaterService.state()?.phase;
            sideMenuFeatureHandle.updateBadgeColor(
              phase === "available" || phase === "ready" ? "var(--color-green)" : undefined,
            );
          },
          { injector },
        );
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => {
          sideMenuFeatureHandle.close();
        });
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
