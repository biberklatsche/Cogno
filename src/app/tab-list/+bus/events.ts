import {MessageBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";
import {ShellConfigPosition} from "../../config/+models/config.types";

export type TabAddedEvent = MessageBase<"TabAdded", {tabId: TabId, isActive: boolean, shellConfigPosition?: ShellConfigPosition, workingDir?: string}>
export type TabRemovedEvent = MessageBase<"TabRemoved", TabId>
export type TabSelectedEvent = MessageBase<"TabSelected", TabId>
