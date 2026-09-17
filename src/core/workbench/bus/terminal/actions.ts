import { ActionBase } from "@cogno/core/workbench/bus/app-bus";
import { TerminalId } from "@cogno/shared/domain";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>;
export type TerminalRemovedAction = ActionBase<"TerminalRemoved", TerminalId>;
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>;
export type WriteRawToPtyAction = ActionBase<
  "WriteRawToPty",
  {
    terminalId: TerminalId;
    text: string;
    autoExecute?: boolean;
  }
>;
