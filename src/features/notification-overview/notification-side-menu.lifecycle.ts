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
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    let iconEffect: EffectRef | undefined;

    return {
      onModeChange: (mode) => {
        iconEffect?.destroy();
        iconEffect = undefined;
        if (mode !== "on") {
          this.notificationCenterStateService.stop();
          sideMenuFeatureHandle.updateIcon("mdiBell");
          return;
        }
        this.notificationCenterStateService.start();
        // The badge says something arrived, even while the panel is closed.
        iconEffect = effect(
          () => {
            sideMenuFeatureHandle.updateIcon(
              this.notificationCenterStateService.unread() ? "mdiBellBadge" : "mdiBell",
            );
          },
          { injector },
        );
      },
      onOpen: () => {
        this.notificationCenterStateService.markRead();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () =>
          sideMenuFeatureHandle.close(),
        );
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
