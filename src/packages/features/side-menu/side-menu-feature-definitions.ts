import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";
import { commandPaletteSideMenuFeatureDefinition } from "./command-palette/command-palette.feature-definition";
import { llmChatSideMenuFeatureDefinition } from "./llm/llm-chat.feature-definition";
import { notificationSideMenuFeatureDefinition } from "./notification/notification.feature-definition";
import { terminalSearchSideMenuFeatureDefinition } from "./terminal-search/terminal-search.feature-definition";
import { workspaceSideMenuFeatureDefinition } from "./workspace/workspace.feature-definition";

export const featureSideMenuFeatureDefinitions = [
  workspaceSideMenuFeatureDefinition,
  commandPaletteSideMenuFeatureDefinition,
  notificationSideMenuFeatureDefinition,
  terminalSearchSideMenuFeatureDefinition,
  llmChatSideMenuFeatureDefinition,
] as const satisfies ReadonlyArray<SideMenuFeatureDefinitionContract<string, string>>;
