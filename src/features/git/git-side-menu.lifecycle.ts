import { Injectable } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core/api/contributions";
import { GitRepositoryService } from "./git-repository.service";
import { GitViewState } from "./git-view-state.service";

@Injectable({ providedIn: "root" })
export class GitSideMenuLifecycle {
  constructor(
    private readonly repository: GitRepositoryService,
    private readonly view: GitViewState,
  ) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        this.repository.start();
      },
      onClose: () => {
        this.repository.stop();
      },
      onFocus: () => {
        // Escape closes an open diff first, as in GitKraken; then the panel.
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => {
          if (this.view.diff()) this.view.closeDiff();
          else sideMenuFeatureHandle.close();
        });
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
