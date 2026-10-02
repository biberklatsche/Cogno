import { ActionBase } from "@cogno/core/workbench/bus/message-base";
import { TerminalId } from "@cogno/shared/domain";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>;
export type TerminalRemovedAction = ActionBase<"TerminalRemoved", TerminalId>;
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>;
