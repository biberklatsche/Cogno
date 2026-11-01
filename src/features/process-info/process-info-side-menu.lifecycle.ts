import { Injectable } from "@angular/core";
import { SideMenuFeatureLifecycleContract } from "@cogno/core/api/contributions";
import { ProcessInfoService } from "./process-info.service";

@Injectable({ providedIn: "root" })
export class ProcessInfoSideMenuLifecycle {
  constructor(private readonly processInfoService: ProcessInfoService) {}

  create(): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        this.processInfoService.start();
      },
      onClose: () => {
        this.processInfoService.stop();
      },
    };
  }
}
