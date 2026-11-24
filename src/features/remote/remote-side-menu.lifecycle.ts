import { Injectable } from "@angular/core";
import { SideMenuFeatureLifecycleContract } from "@cogno/core/api/contributions";
import { PairingPort } from "@cogno/core/api/pairing-port";
import { RemotePanelService } from "./remote-panel.service";

@Injectable({ providedIn: "root" })
export class RemoteSideMenuLifecycle {
  constructor(
    private readonly panel: RemotePanelService,
    private readonly pairing: PairingPort,
  ) {}

  create(): SideMenuFeatureLifecycleContract {
    return {
      // Remote off: this machine is reachable for no one.
      onModeChange: (mode) => void (mode === "on" ? this.pairing.enable() : this.pairing.disable()),
      onOpen: () => this.panel.open(),
      onClose: () => this.panel.close(),
    };
  }
}
