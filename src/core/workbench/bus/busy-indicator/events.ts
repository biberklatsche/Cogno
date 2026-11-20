import { MessageBase } from "@cogno/core/workbench/bus/message-base";
import type { StatusIndicator } from "@cogno/shared/ui";

/**
 * Registers an animation on the busy indicator of a terminal: it shows in the
 * pane header and in the tab the terminal is in.
 *
 * `indicator`: what the indicator shows, the motif and its mood.
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
    indicator: StatusIndicator;
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
