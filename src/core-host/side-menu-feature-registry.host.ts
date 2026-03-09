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
  private readonly sideMenuFeatureDefinitionsById = new Map<
    string,
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  >();

  registerSideMenuFeature(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>,
  ): void {
    const existingDefinition = this.sideMenuFeatureDefinitionsById.get(sideMenuFeatureDefinition.id);
    if (existingDefinition !== undefined) {
      this.sideMenuFeatureDefinitionsById.set(sideMenuFeatureDefinition.id, {
        ...existingDefinition,
        ...sideMenuFeatureDefinition,
      });
      return;
    }

    this.sideMenuFeatureDefinitionsById.set(sideMenuFeatureDefinition.id, sideMenuFeatureDefinition);
  }

  getSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName> | undefined {
    return this.sideMenuFeatureDefinitionsById.get(sideMenuFeatureDefinitionId);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  > {
    return [...this.sideMenuFeatureDefinitionsById.values()].sort((leftDefinition, rightDefinition) => {
      return leftDefinition.order - rightDefinition.order;
    });
  }
}
