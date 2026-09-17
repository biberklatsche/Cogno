import { ActionBase } from "@cogno/core/workbench/bus/app-bus";
import { TerminalId } from "@cogno/shared/domain";

export type FocusActiveTerminalAction = ActionBase<"FocusActiveTerminal", TerminalId>;
