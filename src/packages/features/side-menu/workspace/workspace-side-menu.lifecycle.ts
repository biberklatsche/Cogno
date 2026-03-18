import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-sdk";
import { WorkspaceService } from "./workspace.service";

@Injectable({ providedIn: "root" })
export class WorkspaceSideMenuLifecycle {
  constructor(private readonly workspaceService: WorkspaceService) {}

  create(sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>): SideMenuFeatureLifecycleContract {
    return {
      onModeChange: (mode) => {
        if (mode === "off") {
          sideMenuFeatureHandle.unregisterKeybindListener();
        }
      },
      onOpen: () => {
        this.workspaceService.initializeSelection();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(
          ["Enter", "Escape", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"],
          (keyboardEvent: KeyboardEvent) => {
            if (keyboardEvent.key === "Escape") {
              sideMenuFeatureHandle.close();
              return;
            }
            if (keyboardEvent.key === "Enter") {
              void this.workspaceService.restoreSelectedWorkspace().then(() => {
                sideMenuFeatureHandle.close();
              });
              return;
            }
            if (keyboardEvent.key === "ArrowDown") {
              this.workspaceService.selectNext("down");
              return;
            }
            if (keyboardEvent.key === "ArrowUp") {
              this.workspaceService.selectNext("up");
              return;
            }
            if (keyboardEvent.key === "ArrowLeft") {
              this.workspaceService.selectNext("left");
              return;
            }
            if (keyboardEvent.key === "ArrowRight") {
              this.workspaceService.selectNext("right");
            }
          },
        );
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
      onClose: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
