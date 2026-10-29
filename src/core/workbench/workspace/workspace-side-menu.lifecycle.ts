import { Injectable } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core/api/contributions";
import { SelectionDirection } from "./grid-navigation";
import { WorkspaceService } from "./workspace.service";

const ARROW_DIRECTIONS: Record<string, SelectionDirection> = {
  ArrowDown: "down",
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowRight: "right",
};

@Injectable({ providedIn: "root" })
export class WorkspaceSideMenuLifecycle {
  constructor(private readonly workspaceService: WorkspaceService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(
          ["Enter", ...Object.keys(ARROW_DIRECTIONS)],
          (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.key === "Enter") {
              void this.workspaceService.restoreSelectedWorkspace().then(() => {
                sideMenuFeatureHandle.close();
              });
              return;
            }
            this.workspaceService.selectNext(ARROW_DIRECTIONS[keyboardEvent.key]);
          },
        );
      },
    };
  }
}
