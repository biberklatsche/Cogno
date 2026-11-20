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
        // Escape undoes one thing at a time, the nearest first: the branch name being typed,
        // the filter, the marked branches, an open diff as in GitKraken, then the panel. It
        // comes here before the fields themselves see it, so their part is done here too.
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => {
          if (this.view.newBranchAt()) this.view.newBranchAt.set(null);
          else if (this.view.refsFilter()) this.view.refsFilter.set("");
          else if (this.view.hasMarks()) this.view.clearMarks();
          else if (this.view.diff()) this.view.closeDiff();
          else sideMenuFeatureHandle.close();
        });
      },
    };
  }
}
