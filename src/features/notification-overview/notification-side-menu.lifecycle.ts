import { EffectRef, effect, Injectable, Injector } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core/api/contributions";
import { NotificationCenterStateService } from "./notification-center-state.service";

@Injectable({ providedIn: "root" })
export class NotificationSideMenuLifecycle {
  constructor(private readonly notificationCenterStateService: NotificationCenterStateService) {}

  create(
    injector: Injector,
    sideMenuFeatureHandle: SideMenuFeatureHandleContract,
  ): SideMenuFeatureLifecycleContract {
    let badgeEffect: EffectRef | undefined;

    return {
      onModeChange: (mode) => {
        badgeEffect?.destroy();
        badgeEffect = undefined;
        if (mode !== "on") {
          this.notificationCenterStateService.stop();
          sideMenuFeatureHandle.updateBadgeColor(undefined);
          return;
        }
        this.notificationCenterStateService.start();
        // The dot says something arrived, even while the panel is closed.
        badgeEffect = effect(
          () => {
            sideMenuFeatureHandle.updateBadgeColor(
              this.notificationCenterStateService.unread() ? "var(--highlight-color)" : undefined,
            );
          },
          { injector },
        );
      },
      onOpen: () => {
        this.notificationCenterStateService.markRead();
      },
    };
  }
}
