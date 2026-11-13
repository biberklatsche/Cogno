import { ActionBase } from "@cogno/core/workbench/bus/message-base";
import { TerminalId } from "@cogno/shared/domain";

export type FocusTerminalAction = ActionBase<"FocusTerminal", TerminalId>;
export type TerminalRemovedAction = ActionBase<"TerminalRemoved", TerminalId>;
export type BlurTerminalAction = ActionBase<"BlurTerminal", TerminalId>;
/** Show a shell here again that another Cogno took over. */
export type ReattachTerminalAction = ActionBase<"ReattachTerminal", TerminalId>;
/**
 * End this machine's host from an older Cogno, which this one cannot talk
 * to, and start the shells that could not start because of it.
 */
export type ReplaceOldLocalHostAction = ActionBase<"ReplaceOldLocalHost">;
