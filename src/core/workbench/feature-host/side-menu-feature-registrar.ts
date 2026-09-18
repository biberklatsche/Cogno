import { DestroyRef, Injectable, Injector } from "@angular/core";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { SideMenuFeatureDefinition } from "@cogno/core/workbench/side-menu/+state/side-menu-feature-definitions";
import { FeatureDefinition } from "@cogno/shared/contributions";
import { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { FeatureContributionRegistrar } from "./feature-reconciler";
import { SideMenuFeatureRuntime } from "./side-menu-feature-runtime";

/**
 * The side-menu contribution as the reconciler sees it: activating a feature
 * builds and shows its side-menu entries, deactivating disposes them. One
 * runtime per activation - nothing outlives the feature being off - and every
 * live runtime is disposed when the app shuts down.
 */
@Injectable({ providedIn: "root" })
export class SideMenuFeatureRegistrar implements FeatureContributionRegistrar {
  private readonly runtimesByFeatureId = new Map<string, SideMenuFeatureRuntime[]>();

  constructor(
    private readonly injector: Injector,
    private readonly sideMenuService: SideMenuService,
    private readonly bus: AppBus,
    private readonly keybinds: KeybindService,
    private readonly applicationConfigurationPort: ApplicationConfigurationPort,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => {
      for (const featureId of [...this.runtimesByFeatureId.keys()]) {
        this.disposeRuntimes(featureId);
      }
    });
  }

  register(feature: FeatureDefinition<ActionName>): void {
    if (this.runtimesByFeatureId.has(feature.id)) {
      return;
    }
    const runtimes = (feature.sideMenu ?? []).map((definition) => {
      const runtime = this.createRuntime(definition as SideMenuFeatureDefinition);
      runtime.activate();
      return runtime;
    });
    this.runtimesByFeatureId.set(feature.id, runtimes);
  }

  unregister(feature: FeatureDefinition<ActionName>): void {
    this.disposeRuntimes(feature.id);
  }

  private disposeRuntimes(featureId: string): void {
    for (const runtime of this.runtimesByFeatureId.get(featureId) ?? []) {
      runtime.dispose();
    }
    this.runtimesByFeatureId.delete(featureId);
  }

  private createRuntime(definition: SideMenuFeatureDefinition): SideMenuFeatureRuntime {
    return new SideMenuFeatureRuntime(
      definition,
      this.injector,
      this.sideMenuService,
      this.bus,
      this.keybinds,
      this.applicationConfigurationPort,
    );
  }
}
