import {MessageBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";
import {ShellConfigPosition} from "../../config/+models/config";

export type TabAddedEvent = MessageBase<"TabAddedEvent", {tabId: TabId, shellConfigPosition?: ShellConfigPosition, workingDir?: string}>
export type TabRemovedEvent = MessageBase<"TabRemovedEvent", TabId>
export type TabSelectedEvent = MessageBase<"TabSelectedEvent", TabId>