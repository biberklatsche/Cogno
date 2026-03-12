import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { proExampleSideMenuFeatureDefinition } from "./pro-example/pro-example.feature-definition";

export const proFeatureSideMenuFeatureDefinitions = [] as const satisfies ReadonlyArray< //[proExampleSideMenuFeatureDefinition] as const satisfies ReadonlyArray<
  SideMenuFeatureDefinitionContract<Type<unknown>, string, string>
>;
