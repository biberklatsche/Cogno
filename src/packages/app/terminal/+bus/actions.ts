import { TerminalId } from "@cogno/core-api";
import { ActionBase } from "../../app-bus/app-bus";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>;
export type RevealTerminalAction = ActionBase<"RevealTerminal", TerminalId>;
export type TerminalRemovedAction = ActionBase<"TerminalRemoved", TerminalId>;
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>;
export type ClearBufferAction = ActionBase<"ClearBuffer", TerminalId>;
export type PasteAction = ActionBase<"Paste", TerminalId>;
export type CopyAction = ActionBase<"Copy", TerminalId>;
export type CutAction = ActionBase<"Cut", TerminalId>;
export type ClearLineAction = ActionBase<"ClearLine", TerminalId>;
export type ClearLineToEndAction = ActionBase<"ClearLineToEnd", TerminalId>;
export type ClearLineToStartAction = ActionBase<"ClearLineToStart", TerminalId>;
export type DeletePreviousWordAction = ActionBase<"DeletePreviousWord", TerminalId>;
export type DeleteNextWordAction = ActionBase<"DeleteNextWord", TerminalId>;
export type GoToNextWordAction = ActionBase<"GoToNextWord", TerminalId>;
export type GoToPreviousWordAction = ActionBase<"GoToPreviousWord", TerminalId>;
export type GoToStartOfLineAction = ActionBase<"GoToStartOfLine", TerminalId>;
export type GoToEndOfLineAction = ActionBase<"GoToEndOfLine", TerminalId>;
export type SelectAllAction = ActionBase<"SelectAll", TerminalId>;
export type SelectTextRightAction = ActionBase<"SelectTextRight", TerminalId>;
export type SelectTextLeftAction = ActionBase<"SelectTextLeft", TerminalId>;
export type SelectWordRightAction = ActionBase<"SelectWordRight", TerminalId>;
export type SelectWordLeftAction = ActionBase<"SelectWordLeft", TerminalId>;
export type SelectTextToEndOfLineAction = ActionBase<"SelectTextToEndOfLine", TerminalId>;
export type SelectTextToStartOfLineAction = ActionBase<"SelectTextToStartOfLine", TerminalId>;
export type ReplaceTerminalInputAction = ActionBase<
  "ReplaceTerminalInput",
  {
    terminalId: TerminalId;
    inputText: string;
    cursorIndex: number;
    autoExecute?: boolean;
  }
>;
export type WriteRawToPtyAction = ActionBase<
  "WriteRawToPty",
  {
    terminalId: TerminalId;
    text: string;
    autoExecute?: boolean;
  }
>;
