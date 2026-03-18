import { DestroyRef, Injectable, Injector } from "@angular/core";
import { SideMenuFeatureHandleContract, SideMenuFeatureLifecycleContract } from "@cogno/core-sdk";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";
import { Icon } from "@cogno/core-ui";
import { KeybindService } from "../keybinding/keybind.service";
import { createSideMenuFeature, SideMenuFeature } from "../menu/side-menu/+state/side-menu-feature";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { AppWiringService } from "@cogno/app-setup/app-host/app-wiring.service";

@Injectable({ providedIn: "root" })
export class SideMenuLifecycleRuntimeService {
  private readonly lifecycleFeatureHandles: SideMenuFeature[] = [];

  constructor(
    private readonly wiringService: AppWiringService,
    private readonly injector: Injector,
    private readonly sideMenuService: SideMenuService,
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
    private readonly keybindService: KeybindService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.initializeLifecycleFeatures();
  }

  private initializeLifecycleFeatures(): void {
    const sideMenuFeatureDefinitions = this.wiringService.getSideMenuFeatureDefinitions();

    for (const sideMenuFeatureDefinition of sideMenuFeatureDefinitions) {
      let sideMenuFeatureHandle: SideMenuFeature | undefined;
      const sideMenuFeatureHandleProxy = this.createSideMenuFeatureHandleProxy(
        () => this.getRequiredSideMenuFeatureHandle(sideMenuFeatureHandle),
      );

      let sideMenuFeatureLifecycle: SideMenuFeatureLifecycleContract = {};
      if (sideMenuFeatureDefinition.createLifecycle) {
        sideMenuFeatureLifecycle = sideMenuFeatureDefinition.createLifecycle(
          this.injector,
          sideMenuFeatureHandleProxy,
        );
      }

      sideMenuFeatureHandle = createSideMenuFeature(
        sideMenuFeatureDefinition,
        sideMenuFeatureLifecycle,
        {
          sideMenuService: this.sideMenuService,
          bus: this.appBus,
          configService: this.configService,
          keybinds: this.keybindService,
          destroyRef: this.destroyRef,
        },
      );

      this.lifecycleFeatureHandles.push(sideMenuFeatureHandle);
    }
  }

  private createSideMenuFeatureHandleProxy(
    resolveSideMenuFeatureHandle: () => SideMenuFeature,
  ): SideMenuFeatureHandleContract<Icon> {
    return {
      registerKeybindListener: (keys, handler) => resolveSideMenuFeatureHandle().registerKeybindListener(keys, handler),
      unregisterKeybindListener: () => resolveSideMenuFeatureHandle().unregisterKeybindListener(),
      close: () => resolveSideMenuFeatureHandle().close(),
      updateIcon: (icon) => resolveSideMenuFeatureHandle().updateIcon(icon),
    };
  }

  private getRequiredSideMenuFeatureHandle(sideMenuFeatureHandle?: SideMenuFeature): SideMenuFeature {
    if (!sideMenuFeatureHandle) {
      throw new Error("Side menu feature handle is not initialized.");
    }
    return sideMenuFeatureHandle;
  }
}
