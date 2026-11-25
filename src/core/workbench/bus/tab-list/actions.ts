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
    /** The id of the paired machine that shell runs on; left out for this one. */
    host?: string;
    /**
     * The user asked to show that shell here: the pane takes it from whoever
     * shows it. Without, a pane that finds its shell shown elsewhere says so.
     */
    takeOver?: boolean;
  }
>;
