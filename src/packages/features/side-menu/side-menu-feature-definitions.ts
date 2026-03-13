import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { commandPaletteSideMenuFeatureDefinition } from "./command-palette/command-palette.feature-definition";
import { notificationSideMenuFeatureDefinition } from "./notification/notification.feature-definition";
import { terminalSearchSideMenuFeatureDefinition } from "./terminal-search/terminal-search.feature-definition";
import { workspaceSideMenuFeatureDefinition } from "./workspace/workspace.feature-definition";

export const baseFeatureSideMenuFeatureDefinitions = [
  workspaceSideMenuFeatureDefinition,
  commandPaletteSideMenuFeatureDefinition,
  notificationSideMenuFeatureDefinition,
  terminalSearchSideMenuFeatureDefinition,
] as const satisfies ReadonlyArray<
  SideMenuFeatureDefinitionContract<Type<unknown>, string, string>
>;
