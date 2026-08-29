import type { SessionModelSnapshot } from "@cogno/core/session/model/session-model";
import type { MachineStateSnapshot } from "@cogno/core/terminal/machine-state";
import type { TerminalViewportDimensions } from "@cogno/core/terminal/terminal-machine.state";

export type { TerminalInput } from "@cogno/core/session/model/session-model";
export type { TerminalProgress, TerminalProgressState } from "@cogno/core/terminal/machine-state";
export type {
  Position,
  TerminalCursorPosition,
  TerminalMousePosition,
} from "@cogno/core/terminal/terminal-machine.state";

export type TerminalDimensions = TerminalViewportDimensions;

/** Both halves as one object, for the consumers that still read it that way. */
export type TerminalState = MachineStateSnapshot & SessionModelSnapshot;
