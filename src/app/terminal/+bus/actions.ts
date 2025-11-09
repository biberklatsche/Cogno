import {ActionBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>
export type TerminalRemovedAction = ActionBase<"TerminalRemoved", TerminalId>
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>
export type ClearBufferAction = ActionBase<"ClearBuffer", TerminalId>
export type PasteAction = ActionBase<"Paste", TerminalId>
export type CopyAction = ActionBase<"Copy", TerminalId>
