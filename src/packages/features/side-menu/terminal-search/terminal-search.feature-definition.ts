import { SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";

export const terminalSearchFeatureId = "terminal-search";

export const terminalSearchSideMenuFeatureDefinition = {
  id: terminalSearchFeatureId,
  title: "Terminal Search",
  icon: "mdiFilter",
  order: 40,
  actionName: "open_terminal_search",
  configPath: "feature.search",
} as const satisfies SideMenuFeatureDefinitionContract;
