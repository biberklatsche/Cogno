import {MessageBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";

export type TabTitle = {
    tabId: TabId;
    title: string;
}
export type TabTitleChangedEvent = MessageBase<"TabTitleChanged", TabTitle>;
