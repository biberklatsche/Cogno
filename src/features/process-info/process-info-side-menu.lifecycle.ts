import { Injectable } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/shared/contributions";
import { ProcessInfoService } from "./process-info.service";

@Injectable({ providedIn: "root" })
export class ProcessInfoSideMenuLifecycle {
  constructor(private readonly processInfoService: ProcessInfoService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        this.processInfoService.start();
      },
      onClose: () => {
        this.processInfoService.stop();
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
