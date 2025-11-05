import {ActionBase} from "../../app-bus/app-bus";
import {TerminalId} from "../+model/model";

export type RemovePaneAction = ActionBase<"RemovePane", TerminalId>
export type SplitPaneRightAction = ActionBase<"SplitPaneRight", TerminalId>
export type SplitPaneLeftAction = ActionBase<"SplitPaneLeft", TerminalId>
export type SplitPaneUpAction = ActionBase<"SplitPaneUp", TerminalId>
export type SplitPaneDownAction = ActionBase<"SplitPaneDown", TerminalId>