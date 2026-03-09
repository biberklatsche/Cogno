import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition.contract";

export interface SideMenuFeatureRegistryContract<
  TComponent = unknown,
  TIcon = string,
  TActionName = string,
> {
  registerSideMenuFeature(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>,
  ): void;
  getSideMenuFeatureDefinitionById(
    sideMenuFeatureDefinitionId: string,
  ): SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName> | undefined;
  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  >;
}
