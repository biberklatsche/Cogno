import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { GitStatusService } from "./git-status.service";

@Injectable({ providedIn: "root" })
export class GitSideMenuLifecycle {
  constructor(private readonly gitStatusService: GitStatusService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        this.gitStatusService.startPolling();
      },
      onClose: () => {
        this.gitStatusService.stopPolling();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], (keyboardEvent) => {
          if (keyboardEvent.key === "Escape") {
            sideMenuFeatureHandle.close();
          }
        });
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
