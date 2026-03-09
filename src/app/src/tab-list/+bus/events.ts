import {MessageBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";

export type TabAddedEvent = MessageBase<"TabAdded", {tabId: TabId, isActive: boolean, shellName?: string, workingDir?: string}>
export type TabRemovedEvent = MessageBase<"TabRemoved", TabId>
export type TabSelectedEvent = MessageBase<"TabSelected", TabId>
export type TabRenamedEvent = MessageBase<"TabRenamed", {tabId: TabId, title: string}>
