import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

export interface SideMenuFeatureRegistryContract<TIcon = string, TActionName = string> {
  registerSideMenuFeature(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TIcon, TActionName>,
  ): void;
  getSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinitionContract<TIcon, TActionName> | undefined;
  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TIcon, TActionName>
  >;
}
