import { Injectable } from "@angular/core";
import { AiProviderDetectionService } from "@cogno/features/ai";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/shared/contributions";
import { focusSideMenuAutofocusElement } from "@cogno/shared/ui/common/autofocus/focus-side-menu-autofocus-element";

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
