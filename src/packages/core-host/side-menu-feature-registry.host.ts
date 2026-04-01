import {
  SideMenuFeatureDefinitionContract,
  SideMenuFeatureRegistryContract,
} from "@cogno/core-api";

export class SideMenuFeatureRegistryHost<
  TIcon = string,
  TActionName = string,
> implements SideMenuFeatureRegistryContract<TIcon, TActionName>
{
  private readonly sideMenuFeatureDefinitionsById = new Map<
    string,
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  >();

  registerSideMenuFeature(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TIcon, TActionName>,
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
  ): SideMenuFeatureDefinitionContract<TIcon, TActionName> | undefined {
    return this.sideMenuFeatureDefinitionsById.get(sideMenuFeatureDefinitionId);
  }

  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  > {
    return [...this.sideMenuFeatureDefinitionsById.values()].sort((leftDefinition, rightDefinition) => {
      return leftDefinition.order - rightDefinition.order;
    });
  }
}
