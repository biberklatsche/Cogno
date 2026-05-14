import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { AiProviderDetectionService } from "../../ai/ai-provider-detection.service";
import { focusSideMenuAutofocusElement } from "../focus-side-menu-autofocus-element";

@Injectable({ providedIn: "root" })
export class AiChatSideMenuLifecycle {
  constructor(private readonly aiProviderDetectionService: AiProviderDetectionService) {}

  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => {
        void this.aiProviderDetectionService.detect();
        focusSideMenuAutofocusElement();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], (keyboardEvent) => {
          if (keyboardEvent.key === "Escape") {
            sideMenuFeatureHandle.close();
          }
        });
        focusSideMenuAutofocusElement();
      },
      onBlur: () => sideMenuFeatureHandle.unregisterKeybindListener(),
    };
  }
}
