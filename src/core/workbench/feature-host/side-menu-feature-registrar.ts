import { DestroyRef, Injectable, Injector } from "@angular/core";
import { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import { FeatureDefinition } from "@cogno/core/api/contributions";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { SideMenuFeatureDefinition } from "@cogno/core/workbench/side-menu/+state/side-menu-feature-definitions";
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
    private readonly actions: ActionHandlers,
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
    // Known before they start, so a feature whose entry fails to come up
    // leaves none of its entries behind.
    const runtimes: SideMenuFeatureRuntime[] = [];
    this.runtimesByFeatureId.set(feature.id, runtimes);
    try {
      for (const definition of feature.sideMenu ?? []) {
        const runtime = this.createRuntime(
          definition as SideMenuFeatureDefinition,
          feature.pro === true,
        );
        runtimes.push(runtime);
        runtime.activate();
      }
    } catch (error) {
      this.disposeRuntimes(feature.id);
      throw error;
    }
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

  private createRuntime(
    definition: SideMenuFeatureDefinition,
    pro: boolean,
  ): SideMenuFeatureRuntime {
    return new SideMenuFeatureRuntime(
      definition,
      pro,
      this.injector,
      this.sideMenuService,
      this.bus,
      this.keybinds,
      this.applicationConfigurationPort,
      this.actions,
    );
  }
}
