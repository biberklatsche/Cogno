import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";
import { aiChatSideMenuFeatureDefinition } from "./ai/ai-chat.feature-definition";
import { commandPaletteSideMenuFeatureDefinition } from "./command-palette/command-palette.feature-definition";
import { gitSideMenuFeatureDefinition } from "./git/git.feature-definition";
import { notificationSideMenuFeatureDefinition } from "./notification/notification.feature-definition";
import { terminalSearchSideMenuFeatureDefinition } from "./terminal-search/terminal-search.feature-definition";
import { workspaceSideMenuFeatureDefinition } from "./workspace/workspace.feature-definition";

export const featureSideMenuFeatureDefinitions = [
  workspaceSideMenuFeatureDefinition,
  commandPaletteSideMenuFeatureDefinition,
  notificationSideMenuFeatureDefinition,
  terminalSearchSideMenuFeatureDefinition,
  aiChatSideMenuFeatureDefinition,
  gitSideMenuFeatureDefinition,
] as const satisfies ReadonlyArray<SideMenuFeatureDefinitionContract<string, string>>;
