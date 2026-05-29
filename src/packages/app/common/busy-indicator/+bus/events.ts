import { MessageBase } from "../../../app-bus/app-bus";

export type BusyIndicatorTarget = { kind: "terminal"; id: string } | { kind: "tab"; id: string };

/**
 * Registers an animation on the busy indicator.
 *
 * `target`:
 *   - `{ kind: "terminal", id }` — shows in the pane header AND the tab of that terminal
 *   - `{ kind: "tab", id }` — shows only on the tab
 *
 * `keyframes`: array of frames; each frame has exactly BAR_COUNT (5) height values
 *   in the range [MIN_HEIGHT, MAX_HEIGHT] (1–4). 1 frame = static, N frames = animated loop.
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
    keyframes: number[][];
    priority: number;
  }
>;

export type BusyIndicatorUnregisterEvent = MessageBase<
  "BusyIndicatorUnregister",
  { registrationId: string }
>;
