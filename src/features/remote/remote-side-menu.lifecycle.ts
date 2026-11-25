import { Injectable } from "@angular/core";
import { SideMenuFeatureLifecycleContract } from "@cogno/core/api/contributions";
import { PairingPort } from "@cogno/core/api/pairing-port";
import { RemotePairingRequestPrompt } from "./remote-pairing-request.prompt";
import { RemotePanelService } from "./remote-panel.service";

@Injectable({ providedIn: "root" })
export class RemoteSideMenuLifecycle {
  constructor(
    private readonly panel: RemotePanelService,
    private readonly pairing: PairingPort,
    private readonly requests: RemotePairingRequestPrompt,
  ) {}

  create(): SideMenuFeatureLifecycleContract {
    return {
      // Remote off: this machine is reachable for no one, and nobody asks
      // to pair with it.
      onModeChange: (mode) => {
        if (mode === "on") {
          this.requests.listen();
          void this.pairing.enable();
        } else {
          this.requests.stop();
          void this.pairing.disable();
        }
      },
      onOpen: () => this.panel.open(),
      onClose: () => this.panel.close(),
    };
  }
}
