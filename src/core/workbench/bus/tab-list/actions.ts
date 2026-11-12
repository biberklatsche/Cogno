import { ActionBase } from "@cogno/core/workbench/bus/message-base";
import { TabId } from "@cogno/core/workbench/grid-layout";
import { TerminalId } from "@cogno/shared/domain";

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
    /** The terminal the tab's pane shows: a shell that already runs. */
    terminalId?: TerminalId;
  }
>;
