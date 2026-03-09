import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { commandPaletteSideMenuFeatureDefinition } from "./command-palette/command-palette.feature-definition";
import { terminalSearchSideMenuFeatureDefinition } from "./terminal-search/terminal-search.feature-definition";

export const openFeatureSideMenuFeatureDefinitions = [
  commandPaletteSideMenuFeatureDefinition,
  terminalSearchSideMenuFeatureDefinition,
] as const satisfies ReadonlyArray<
  SideMenuFeatureDefinitionContract<Type<unknown>, string, string>
>;
