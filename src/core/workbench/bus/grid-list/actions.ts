import { ActionBase } from "@cogno/core/workbench/bus/message-base";
import { TerminalId } from "@cogno/shared/domain";

export type FocusActiveTerminalAction = ActionBase<"FocusActiveTerminal", TerminalId>;
