import { ActionBase } from "@cogno/core/workbench/bus/message-base";

/** Give the keyboard to the focused pane of the shown tab. */
export type FocusActiveTerminalAction = ActionBase<"FocusActiveTerminal", void>;
