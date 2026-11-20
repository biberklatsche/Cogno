import type { StatusIndicator } from "@cogno/shared/ui";

export type AnimationSpec = {
  /** What the busy indicator of the terminal's pane and tab shows. */
  readonly indicator: StatusIndicator;
  /** When several registrations target the same indicator, the highest priority wins. */
  readonly priority: number;
};

export abstract class TerminalAnimationPort {
  abstract register(terminalId: string, registrationKey: string, spec: AnimationSpec): void;
  abstract unregister(terminalId: string, registrationKey: string): void;
}
