import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../../../action/action.models";
import { Icon } from "@cogno/ui-kit";

export type SideMenuFeatureDefinition = SideMenuFeatureDefinitionContract<
  Type<unknown>,
  Icon,
  ActionName
>;

export const sideMenuFeatureDefinitions: ReadonlyArray<SideMenuFeatureDefinition> = [];
