import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { sideMenuUiStateFeature } from "@cogno/core/workbench/side-menu/ui-state/ui-state.feature";
import { workspaceFeature } from "@cogno/core/workbench/workspace/workspace.feature-definition";
import { autocompleteFeature } from "@cogno/features/autocomplete";
import { codingAgentsFeature } from "@cogno/features/coding-agent";
import { commandPaletteFeature } from "@cogno/features/command-palette";
import { featureSettingsFeature } from "@cogno/features/feature-settings-extension";
import { gitFeature } from "@cogno/features/git";
import { notificationFeature } from "@cogno/features/notification-overview";
import { processInfoFeature } from "@cogno/features/process-info";
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
  gitFeature,
  processInfoFeature,
  codingAgentsFeature,
] as const satisfies readonly FeatureDefinition<ActionName>[];
