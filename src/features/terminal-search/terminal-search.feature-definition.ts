import { FeatureDefinition, SideMenuFeatureDefinitionContract } from "@cogno/shared/contributions";
import { TerminalSearchSideMenuLifecycle } from "./terminal-search-side-menu.lifecycle";

const terminalSearchFeatureId = "terminal-search";

const terminalSearchSideMenuFeatureDefinition = {
  id: terminalSearchFeatureId,
  title: "Terminal Search",
  icon: "mdiFilter",
  order: 40,
  actionName: "open_terminal_search",
  configPath: "feature.search",
  targetComponent: () =>
    import("./terminal-search-side.component").then((m) => m.TerminalSearchSideComponent),
  createLifecycle: (injector, sideMenuFeatureHandle) =>
    injector.get(TerminalSearchSideMenuLifecycle).create(sideMenuFeatureHandle),
} as const satisfies SideMenuFeatureDefinitionContract;

export const terminalSearchFeature: FeatureDefinition = {
  mode: "on",
  target: "session",
  id: terminalSearchSideMenuFeatureDefinition.id,
  sideMenu: [terminalSearchSideMenuFeatureDefinition],
};
