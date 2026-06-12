import { TabId, TerminalId } from "@cogno/core-api";
import { MessageBase } from "../../app-bus/app-bus";

export type ChangeTabTitlePayload = {
  tabId: TabId;
  title: string;
};
export type ChangeTabTitleEvent = MessageBase<"ChangeTabTitle", ChangeTabTitlePayload>;
export type PaneMaximizedChangedEvent = MessageBase<
  "PaneMaximizedChanged",
  { terminalId?: TerminalId }
>;
export type VisibleTerminalsChangedEvent = MessageBase<
  "VisibleTerminalsChanged",
  { terminalIds: TerminalId[] }
>;
