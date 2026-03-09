import {
  SideMenuFeatureDefinitionContract,
  SideMenuFeatureRegistryContract,
} from "@cogno/core-sdk";

export class SideMenuFeatureRegistryHost<
    TComponent = unknown,
    TIcon = string,
    TActionName = string,
  >
  implements SideMenuFeatureRegistryContract<TComponent, TIcon, TActionName>
{
  private readonly sideMenuFeatureDefinitionsByLabel = new Map<
    string,
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  >();

  registerSideMenuFeature(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>,
  ): void {
    const existingDefinition = this.sideMenuFeatureDefinitionsByLabel.get(sideMenuFeatureDefinition.label);
    if (existingDefinition !== undefined) {
      this.sideMenuFeatureDefinitionsByLabel.set(sideMenuFeatureDefinition.label, {
        ...existingDefinition,
        ...sideMenuFeatureDefinition,
      });
      return;
    }

    this.sideMenuFeatureDefinitionsByLabel.set(sideMenuFeatureDefinition.label, sideMenuFeatureDefinition);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  > {
    return [...this.sideMenuFeatureDefinitionsByLabel.values()];
  }
}
