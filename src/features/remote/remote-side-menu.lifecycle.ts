import { Injectable } from "@angular/core";
import { SideMenuFeatureLifecycleContract } from "@cogno/core/api/contributions";
import { RemotePanelService } from "./remote-panel.service";

@Injectable({ providedIn: "root" })
export class RemoteSideMenuLifecycle {
  constructor(private readonly panel: RemotePanelService) {}

  create(): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => this.panel.open(),
      onClose: () => this.panel.close(),
    };
  }
}
