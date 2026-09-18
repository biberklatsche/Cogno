import { MessageBase } from "@cogno/core/workbench/bus/app-bus";
import { TabId, TerminalId } from "@cogno/shared/domain";

type ChangeTabTitlePayload = {
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
