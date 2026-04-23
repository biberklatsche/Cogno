import { TabId } from "@cogno/core-api";
import { MessageBase } from "../../app-bus/app-bus";
import { TerminalId } from "../+model/model";

export type ChangeTabTitlePayload = {
  tabId: TabId;
  title: string;
};
export type ChangeTabTitleEvent = MessageBase<"ChangeTabTitle", ChangeTabTitlePayload>;
export type PaneMaximizedChangedEvent = MessageBase<
  "PaneMaximizedChanged",
  { terminalId?: TerminalId }
>;
