import { MessageBase } from "@cogno/core/workbench/bus/message-base";
import { TabId } from "@cogno/core/workbench/grid-layout";
import { TerminalId } from "@cogno/shared/domain";

type ChangeTabTitlePayload = {
  tabId: TabId;
  title: string;
};
export type ChangeTabTitleEvent = MessageBase<"ChangeTabTitle", ChangeTabTitlePayload>;
export type VisibleTerminalsChangedEvent = MessageBase<
  "VisibleTerminalsChanged",
  { terminalIds: TerminalId[] }
>;
