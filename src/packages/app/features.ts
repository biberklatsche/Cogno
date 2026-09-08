import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { sideMenuUiStateFeature } from "@cogno/core/workbench/side-menu/ui-state/ui-state.feature";
import { workspaceFeature } from "@cogno/core/workbench/workspace/workspace.feature-definition";
import { autocompleteFeature } from "@cogno/features/autocomplete/autocomplete.feature";
import { commandPaletteFeature } from "@cogno/features/command-palette";
import { featureSettingsFeature } from "@cogno/features/feature-settings-extension";
import { gitFeature } from "@cogno/features/git";
import { notificationFeature } from "@cogno/features/notification-overview";
import { aiChatFeature } from "@cogno/features/side-menu/ai/ai-chat.feature-definition";
import { codingAgentsFeature } from "@cogno/features/side-menu/coding-agents/coding-agents.feature-definition";
import { terminalSearchFeature } from "@cogno/features/terminal-search";
import { FeatureDefinition } from "@cogno/shared/contributions";

/**
 * Every feature of the application. Adding one means adding it here. `as
 * const` keeps each entry's literal types so the action-name manifest (step
 * 26) can read them; `satisfies` still checks every entry is a feature.
 */
export const features = [
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
] as const satisfies readonly FeatureDefinition<ActionName>[];
