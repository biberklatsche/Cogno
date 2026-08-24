import { Injectable } from "@angular/core";
import { CodingAgentStartupService } from "@cogno/features/coding-agent";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/shared/contributions";

@Injectable({ providedIn: "root" })
export class CodingAgentsSideMenuLifecycle {
  constructor(private readonly startupService: CodingAgentStartupService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        void this.startupService.rescan();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => {
          sideMenuFeatureHandle.close();
        });
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
