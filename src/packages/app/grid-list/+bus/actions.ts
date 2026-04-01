import {ActionBase} from "../../app-bus/app-bus";
import {TerminalId} from "../+model/model";

export type FocusActiveTerminalAction = ActionBase<"FocusActiveTerminal", TerminalId>
export type RemovePaneAction = ActionBase<"RemovePane", TerminalId>
export type SplitPaneRightAction = ActionBase<"SplitPaneRight", TerminalId>
export type SplitPaneLeftAction = ActionBase<"SplitPaneLeft", TerminalId>
export type SplitPaneUpAction = ActionBase<"SplitPaneUp", TerminalId>
export type SplitPaneDownAction = ActionBase<"SplitPaneDown", TerminalId>
export type SelectNextPaneAction = ActionBase<"SelectNextPane", TerminalId>
export type SelectPreviousPaneAction = ActionBase<"SelectPreviousPane", TerminalId>
export type MaximizePaneAction = ActionBase<"MaximizePane", TerminalId>
export type MinimizePaneAction = ActionBase<"MinimizePane", TerminalId>


