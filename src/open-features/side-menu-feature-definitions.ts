import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { terminalSearchSideMenuFeatureDefinition } from "./terminal-search/terminal-search.feature-definition";

export const openFeatureSideMenuFeatureDefinitions = [
  terminalSearchSideMenuFeatureDefinition,
] as const satisfies ReadonlyArray<
  SideMenuFeatureDefinitionContract<Type<unknown>, string, string>
>;
