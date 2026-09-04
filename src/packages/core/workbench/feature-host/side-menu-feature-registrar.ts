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
 * shows its side-menu entries, deactivating hides them. Each entry's runtime is
 * built once (its lifecycle, view listeners and panel outlive on/off cycles)
 * and reused, mirroring how the side menu behaved before the feature-host.
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
    private readonly destroyRef: DestroyRef,
  ) {}

  register(feature: FeatureDefinition<ActionName>): void {
    for (const runtime of this.runtimesFor(feature)) {
      runtime.activate();
    }
  }

  unregister(feature: FeatureDefinition<ActionName>): void {
    for (const runtime of this.runtimesByFeatureId.get(feature.id) ?? []) {
      runtime.deactivate();
    }
  }

  private runtimesFor(feature: FeatureDefinition<ActionName>): SideMenuFeatureRuntime[] {
    const existing = this.runtimesByFeatureId.get(feature.id);
    if (existing) {
      return existing;
    }
    const runtimes = (feature.sideMenu ?? []).map((definition) =>
      this.createRuntime(definition as SideMenuFeatureDefinition),
    );
    this.runtimesByFeatureId.set(feature.id, runtimes);
    return runtimes;
  }

  private createRuntime(definition: SideMenuFeatureDefinition): SideMenuFeatureRuntime {
    return new SideMenuFeatureRuntime(
      definition,
      this.injector,
      this.sideMenuService,
      this.bus,
      this.keybinds,
      this.applicationConfigurationPort,
      this.destroyRef,
    );
  }
}
