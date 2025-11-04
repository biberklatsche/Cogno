import {ActionBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>
