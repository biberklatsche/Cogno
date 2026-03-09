import { Type } from "@angular/core";
import { SideMenuFeatureDefinitionContract } from "@cogno/core-sdk";
import { ActionName } from "../action/action.models";
import { Icon } from "../icons/+model/icon";
import { TerminalSearchSideComponent } from "./terminal-search-side.component";

export const terminalSearchFeatureDefinition: SideMenuFeatureDefinitionContract<
  Type<unknown>,
  Icon,
  ActionName
> = {
  label: "Terminal Search",
  icon: "mdiFilter",
  actionName: "open_terminal_search",
  component: TerminalSearchSideComponent,
  configPath: "terminal_search",
};
