import { TabId } from "@cogno/core-api";
import { ActionBase } from "../../app-bus/app-bus";

export type SelectTabAction = ActionBase<"SelectTab", TabId>;
export type RemoveTabAction = ActionBase<"RemoveTab", TabId>;
export type CreateTabAction = ActionBase<
  "CreateTab",
  {
    tabId: TabId;
    systemTitle?: string;
    isActive?: boolean;
    shellName?: string;
    workingDir?: string;
  }
>;
