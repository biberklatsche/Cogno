import {
  SideMenuFeatureDefinitionContract,
  SideMenuFeatureRegistryContract,
} from "@cogno/core-api";

export class SideMenuFeatureRegistryHost<
  TIcon = string,
  TActionName = string,
  TSideMenuFeatureExtension extends { id: string } = never,
> implements SideMenuFeatureRegistryContract<TIcon, TActionName>
{
  private readonly sideMenuFeatureDefinitionsById = new Map<
    string,
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  >();
  private readonly sideMenuFeatureExtensionsById = new Map<string, TSideMenuFeatureExtension>();

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

  registerSideMenuFeatureExtension(
    sideMenuFeatureExtension: TSideMenuFeatureExtension,
  ): void {
    const existingExtension = this.sideMenuFeatureExtensionsById.get(sideMenuFeatureExtension.id);
    if (existingExtension !== undefined) {
      this.sideMenuFeatureExtensionsById.set(sideMenuFeatureExtension.id, {
        ...existingExtension,
        ...sideMenuFeatureExtension,
      });
      return;
    }

    this.sideMenuFeatureExtensionsById.set(sideMenuFeatureExtension.id, sideMenuFeatureExtension);
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

  resolveSideMenuFeatureDefinitionById<TResolved>(
    sideMenuFeatureDefinitionId: string,
    resolveDefinition: (
      sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TIcon, TActionName>,
      sideMenuFeatureExtension: TSideMenuFeatureExtension | undefined,
    ) => TResolved,
  ): TResolved | undefined {
    const sideMenuFeatureDefinition = this.getSideMenuFeatureDefinitionById(sideMenuFeatureDefinitionId);
    if (sideMenuFeatureDefinition === undefined) {
      return undefined;
    }

    return resolveDefinition(
      sideMenuFeatureDefinition,
      this.sideMenuFeatureExtensionsById.get(sideMenuFeatureDefinitionId),
    );
  }

  resolveSideMenuFeatureDefinitions<TResolved>(
    resolveDefinition: (
      sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TIcon, TActionName>,
      sideMenuFeatureExtension: TSideMenuFeatureExtension | undefined,
    ) => TResolved,
  ): ReadonlyArray<TResolved> {
    return this.getSideMenuFeatureDefinitions().map((sideMenuFeatureDefinition) =>
      resolveDefinition(
        sideMenuFeatureDefinition,
        this.sideMenuFeatureExtensionsById.get(sideMenuFeatureDefinition.id),
      ),
    );
  }
}
