import { Injectable } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/shared/contributions";
import { CodingAgentStartupService } from "./coding-agent-startup.service";

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
