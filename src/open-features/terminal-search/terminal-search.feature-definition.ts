import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { TerminalSearchSideComponent } from "./terminal-search-side.component";

export const terminalSearchFeatureId = "terminal-search";

export const terminalSearchSideMenuFeatureDefinition = {
  id: terminalSearchFeatureId,
  title: "Terminal Search",
  icon: "mdiFilter",
  order: 40,
  actionName: "open_terminal_search",
  targetComponent: TerminalSearchSideComponent,
  configPath: "terminal_search",
} as const satisfies SideMenuFeatureDefinitionContract<Type<unknown>, string, string>;
