import { SideMenuFeatureDefinitionContract } from "@cogno/core-api";

export const terminalSearchFeatureId = "terminal-search";

export const terminalSearchSideMenuFeatureDefinition = {
  id: terminalSearchFeatureId,
  title: "Terminal Search",
  icon: "mdiFilter",
  order: 40,
  actionName: "open_terminal_search",
  configPath: "search",
} as const satisfies SideMenuFeatureDefinitionContract<string, string>;
