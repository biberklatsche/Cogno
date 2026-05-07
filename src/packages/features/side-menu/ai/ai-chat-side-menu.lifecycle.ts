import { Injectable } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-api";
import { focusSideMenuAutofocusElement } from "../focus-side-menu-autofocus-element";

@Injectable({ providedIn: "root" })
export class AiChatSideMenuLifecycle {
  create(
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    return {
      onOpen: () => focusSideMenuAutofocusElement(),
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
