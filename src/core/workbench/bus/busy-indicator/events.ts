import { MessageBase } from "@cogno/core/workbench/bus/message-base";

/**
 * Registers an animation on the busy indicator of a terminal: it shows in the
 * pane header and in the tab the terminal is in.
 *
 * `keyframes`: array of frames; each frame is a MAX_HEIGHT×BAR_COUNT grid (number[][][]).
 *   grid[row][col], row 0 = top, values 0 (off) to 1 (full on). 1 frame = static, N = loop.
 *
 * `priority`: when multiple registrations target the same display, the highest priority wins.
 *
 * Must be paired with a BusyIndicatorUnregister event using the same registrationId.
 */
export type BusyIndicatorRegisterEvent = MessageBase<
  "BusyIndicatorRegister",
  {
    registrationId: string;
    terminalId: string;
    keyframes: number[][][];
    priority: number;
  }
>;

export type BusyIndicatorUnregisterEvent = MessageBase<
  "BusyIndicatorUnregister",
  { registrationId: string }
>;

/** Removes all registrations of the terminal. */
export type BusyIndicatorClearForTerminalEvent = MessageBase<
  "BusyIndicatorClearForTerminal",
  { terminalId: string }
>;
