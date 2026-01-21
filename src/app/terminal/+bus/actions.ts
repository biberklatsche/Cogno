import {ActionBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>
export type TerminalRemovedAction = ActionBase<"TerminalRemoved", TerminalId>
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>
export type ClearBufferAction = ActionBase<"ClearBuffer", TerminalId>
export type PasteAction = ActionBase<"Paste", TerminalId>
export type CopyAction = ActionBase<"Copy", TerminalId>
export type CutAction = ActionBase<"Cut", TerminalId>
export type ClearLineAction = ActionBase<"ClearLine", TerminalId>
export type ClearLineToEndAction = ActionBase<"ClearLineToEnd", TerminalId>
export type ClearLineToStartAction = ActionBase<"ClearLineToStart", TerminalId>
export type DeletePreviousWordAction = ActionBase<"DeletePreviousWord", TerminalId>
export type DeleteNextWordAction = ActionBase<"DeleteNextWord", TerminalId>
export type GoToNextWordAction = ActionBase<"GoToNextWord", TerminalId>
export type GoToPreviousWordAction = ActionBase<"GoToPreviousWord", TerminalId>
export type SelectTextRightAction = ActionBase<"SelectTextRight", TerminalId>
export type SelectTextLeftAction = ActionBase<"SelectTextLeft", TerminalId>
export type SelectWordRightAction = ActionBase<"SelectWordRight", TerminalId>
export type SelectWordLeftAction = ActionBase<"SelectWordLeft", TerminalId>
export type SelectTextToEndOfLineAction = ActionBase<"SelectTextToEndOfLine", TerminalId>
export type SelectTextToStartOfLineAction = ActionBase<"SelectTextToStartOfLine", TerminalId>
