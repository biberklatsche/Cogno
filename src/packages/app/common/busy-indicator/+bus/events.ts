import { MessageBase } from "../../../app-bus/app-bus";

export type BusyIndicatorTarget = { kind: "terminal"; id: string } | { kind: "tab"; id: string };

/**
 * Registers an animation on the busy indicator.
 *
 * `target`:
 *   - `{ kind: "terminal", id }` — shows in the pane header AND the tab of that terminal
 *   - `{ kind: "tab", id }` — shows only on the tab
 *
 * `keyframes`: array of frames; each frame is a MAX_HEIGHT×BAR_COUNT grid (number[][][]).
 *   grid[row][col], row 0 = top, values 0 (off) to 1 (full on). 1 frame = static, N = loop.
 *   Use BusyIndicatorHelper.register() to manage the lifecycle automatically.
 *
 * `priority`: when multiple registrations target the same display, the highest priority wins.
 *
 * Must be paired with a BusyIndicatorUnregister event using the same registrationId.
 */
export type BusyIndicatorRegisterEvent = MessageBase<
  "BusyIndicatorRegister",
  {
    registrationId: string;
    target: BusyIndicatorTarget;
    keyframes: number[][][];
    priority: number;
  }
>;

export type BusyIndicatorUnregisterEvent = MessageBase<
  "BusyIndicatorUnregister",
  { registrationId: string }
>;

/** Removes all registrations whose target is `{ kind: "terminal", id: terminalId }`. */
export type BusyIndicatorClearForTerminalEvent = MessageBase<
  "BusyIndicatorClearForTerminal",
  { terminalId: string }
>;
