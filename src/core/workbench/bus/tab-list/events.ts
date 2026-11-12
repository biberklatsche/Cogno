import { MessageBase } from "@cogno/core/workbench/bus/message-base";
import { TabId } from "@cogno/core/workbench/grid-layout";
import { TerminalId } from "@cogno/shared/domain";

export type TabAddedEvent = MessageBase<
  "TabAdded",
  {
    tabId: TabId;
    isActive: boolean;
    shellName?: string;
    workingDir?: string;
    terminalId?: TerminalId;
    host?: string;
  }
>;
export type TabRemovedEvent = MessageBase<"TabRemoved", TabId>;
export type TabSelectedEvent = MessageBase<"TabSelected", TabId>;
