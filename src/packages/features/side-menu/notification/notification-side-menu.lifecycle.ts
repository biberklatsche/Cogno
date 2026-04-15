import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { NotificationCenterStateService } from "./notification-center-state.service";

@Injectable({ providedIn: "root" })
export class NotificationSideMenuLifecycle {
  constructor(private readonly notificationCenterStateService: NotificationCenterStateService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    this.notificationCenterStateService.setSideMenuIconUpdater((iconName) => {
      sideMenuFeatureHandle.updateIcon(iconName);
    });

    return {
      onModeChange: (mode) => {
        this.notificationCenterStateService.handleSideMenuModeChange(mode);
      },
      onOpen: () => {
        this.notificationCenterStateService.handleSideMenuOpen();
      },
      onClose: () => {
        this.notificationCenterStateService.handleSideMenuClose();
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
