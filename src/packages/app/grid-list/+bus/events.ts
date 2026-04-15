import { TabId } from "@cogno/core-api";
import { MessageBase } from "../../app-bus/app-bus";
import { TerminalId } from "../+model/model";

export type TabTitle = {
  tabId: TabId;
  title: string;
};
export type TabTitleChangedEvent = MessageBase<"TabTitleChanged", TabTitle>;
export type PaneMaximizedChangedEvent = MessageBase<
  "PaneMaximizedChanged",
  { terminalId?: TerminalId }
>;
