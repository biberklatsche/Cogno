import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../../app/src/action/action.models";
import { Icon } from "../../app/src/icons/+model/icon";
import { TerminalSearchSideComponent } from "./terminal-search-side.component";

export const terminalSearchFeatureId = "terminal-search";

export const terminalSearchSideMenuFeatureDefinition: SideMenuFeatureDefinitionContract<
  Type<unknown>,
  Icon,
  ActionName
> = {
  id: terminalSearchFeatureId,
  title: "Terminal Search",
  icon: "mdiFilter",
  order: 40,
  actionName: "open_terminal_search",
  targetComponent: TerminalSearchSideComponent,
  configPath: "terminal_search",
};
