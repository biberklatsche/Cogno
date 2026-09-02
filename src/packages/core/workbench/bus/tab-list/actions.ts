import { ActionBase } from "@cogno/core/workbench/bus/app-bus";
import { TabId } from "@cogno/shared/domain";

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
