import { Injectable } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core/api/contributions";
import { GitRepositoriesOverviewService } from "./git-repositories-overview.service";
import { GitRepositoryService } from "./git-repository.service";
import { GitViewState } from "./git-view-state.service";

@Injectable({ providedIn: "root" })
export class GitSideMenuLifecycle {
  constructor(
    private readonly repository: GitRepositoryService,
    private readonly overview: GitRepositoriesOverviewService,
    private readonly view: GitViewState,
  ) {}

  create(sideMenuFeatureHandle: SideMenuFeatureHandleContract): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        this.repository.start();
        this.overview.start();
      },
      onClose: () => {
        this.repository.stop();
        this.overview.stop();
      },
      onFocus: () => {
        // Escape clears marked branches first, then closes an open diff as in GitKraken, then the panel.
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => {
          if (this.view.hasMarks()) this.view.clearMarks();
          else if (this.view.diff()) this.view.closeDiff();
          else sideMenuFeatureHandle.close();
        });
      },
    };
  }
}
