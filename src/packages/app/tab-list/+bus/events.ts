import { TabId } from "@cogno/core-api";
import { MessageBase } from "../../app-bus/app-bus";

export type TabAddedEvent = MessageBase<
  "TabAdded",
  { tabId: TabId; isActive: boolean; shellName?: string; workingDir?: string }
>;
export type TabRemovedEvent = MessageBase<"TabRemoved", TabId>;
export type TabSelectedEvent = MessageBase<"TabSelected", TabId>;
export type TabRenamedEvent = MessageBase<"TabRenamed", { tabId: TabId; userTitle?: string }>;
