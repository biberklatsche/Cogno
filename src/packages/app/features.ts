import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { autocompleteFeature } from "@cogno/features/autocomplete/autocomplete.feature";
import { featureSettingsFeature } from "@cogno/features/feature-settings-extension";
import { aiChatFeature } from "@cogno/features/side-menu/ai/ai-chat.feature-definition";
import { codingAgentsFeature } from "@cogno/features/side-menu/coding-agents/coding-agents.feature-definition";
import { commandPaletteFeature } from "@cogno/features/side-menu/command-palette/command-palette.feature-definition";
import { gitFeature } from "@cogno/features/side-menu/git/git.feature-definition";
import { notificationFeature } from "@cogno/features/side-menu/notification/notification.feature-definition";
import { terminalSearchFeature } from "@cogno/features/side-menu/terminal-search/terminal-search.feature-definition";
import { sideMenuUiStateFeature } from "@cogno/features/side-menu/ui-state/ui-state.feature";
import { workspaceFeature } from "@cogno/features/side-menu/workspace/workspace.feature-definition";
import { FeatureDefinition } from "@cogno/shared/contributions";

/** Every feature of the application. Adding one means adding it here. */
export const features: ReadonlyArray<FeatureDefinition<ActionName>> = [
  autocompleteFeature,
  featureSettingsFeature,
  workspaceFeature,
  sideMenuUiStateFeature,
  commandPaletteFeature,
  notificationFeature,
  terminalSearchFeature,
  aiChatFeature,
  gitFeature,
  codingAgentsFeature,
] as ReadonlyArray<FeatureDefinition<ActionName>>;
