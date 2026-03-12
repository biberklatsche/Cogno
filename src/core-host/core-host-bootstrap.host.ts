import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { SideMenuFeatureRegistryHost } from "./side-menu-feature-registry.host";

export class CoreHostBootstrapHost<
  TComponent = unknown,
  TIcon = string,
  TActionName = string,
> {
  constructor(
    private readonly sideMenuFeatureRegistryHost: SideMenuFeatureRegistryHost<
      TComponent,
      TIcon,
      TActionName
    >,
  ) {}

  registerSideMenuFeatures(
    sideMenuFeatureDefinitions: ReadonlyArray<
      SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
    >,
  ): void {
    for (const sideMenuFeatureDefinition of sideMenuFeatureDefinitions) {
      this.sideMenuFeatureRegistryHost.registerSideMenuFeature(sideMenuFeatureDefinition);
    }
  }
}
