import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-sdk";
import { NotificationService } from "./notification.service";

@Injectable({ providedIn: "root" })
export class NotificationSideMenuLifecycle {
  constructor(private readonly notificationService: NotificationService) {}

  create(sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>): SideMenuFeatureLifecycleContract {
    this.notificationService.setSideMenuIconUpdater((iconName) => {
      sideMenuFeatureHandle.updateIcon(iconName);
    });

    return {
      onModeChange: (mode) => {
        this.notificationService.handleSideMenuModeChange(mode);
      },
      onOpen: () => {
        this.notificationService.handleSideMenuOpen();
      },
      onClose: () => {
        this.notificationService.handleSideMenuClose();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => sideMenuFeatureHandle.close());
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
