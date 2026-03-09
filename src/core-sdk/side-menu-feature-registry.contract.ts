import { SideMenuFeatureDefinitionContract } from "./side-menu-feature-definition.contract";

export interface SideMenuFeatureRegistryContract<
  TComponent = unknown,
  TIcon = string,
  TActionName = string,
> {
  registerSideMenuFeature(
    sideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>,
  ): void;
  getSideMenuFeatureDefinitions(): ReadonlyArray<
    SideMenuFeatureDefinitionContract<TComponent, TIcon, TActionName>
  >;
}
