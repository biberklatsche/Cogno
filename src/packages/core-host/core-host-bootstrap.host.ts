import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";
import { SideMenuFeatureRegistryHost } from "./side-menu-feature-registry.host";

export class CoreHostBootstrapHost<
  TIcon = string,
  TActionName = string,
> {
  constructor(
    private readonly sideMenuFeatureRegistryHost: SideMenuFeatureRegistryHost<TIcon, TActionName>,
  ) {}

  registerSideMenuFeatures(
    sideMenuFeatureDefinitions: ReadonlyArray<
      SideMenuFeatureDefinitionContract<TIcon, TActionName>
    >,
  ): void {
    for (const sideMenuFeatureDefinition of sideMenuFeatureDefinitions) {
      this.sideMenuFeatureRegistryHost.registerSideMenuFeature(sideMenuFeatureDefinition);
    }
  }
}
