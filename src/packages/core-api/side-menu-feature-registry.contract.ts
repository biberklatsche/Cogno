import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition.contract";

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
