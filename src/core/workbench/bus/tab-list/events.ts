import { MessageBase } from "@cogno/core/workbench/bus/app-bus";
import { TabId } from "@cogno/shared/domain";

export type TabAddedEvent = MessageBase<
  "TabAdded",
  { tabId: TabId; isActive: boolean; shellName?: string; workingDir?: string }
>;
export type TabRemovedEvent = MessageBase<"TabRemoved", TabId>;
export type TabSelectedEvent = MessageBase<"TabSelected", TabId>;
