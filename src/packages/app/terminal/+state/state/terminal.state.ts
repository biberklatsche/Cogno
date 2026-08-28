import { OsType } from "@cogno/platform/os";
import { ShellSessionCapabilitiesContract } from "@cogno/shared/contributions";
import { ShellContext } from "../advanced/model/models";

export type {
  Position,
  TerminalCursorPosition,
  TerminalMousePosition,
} from "@cogno/core/terminal/terminal-machine.state";

import type {
  TerminalCursorPosition,
  TerminalMousePosition,
  TerminalViewportDimensions,
} from "@cogno/core/terminal/terminal-machine.state";

export type TerminalDimensions = TerminalViewportDimensions;

export type TerminalInput = {
  cursorIndex: number;
  maxCursorIndex: number;
  text: string;
};

export type TerminalProgressState = "hidden" | "default" | "error" | "indeterminate" | "warning";

export type TerminalProgress = {
  state: TerminalProgressState;
  value: number;
};

export type TerminalState = {
  terminalId: string;
  shellContext: ShellContext;
  cursorPosition: TerminalCursorPosition;
  mousePosition: TerminalMousePosition;
  dimensions: TerminalDimensions;
  isFocused: boolean;
  hasSelection: boolean;
  isCommandRunning: boolean;
  isInFullScreenMode: boolean;
  isPaneMaximized: boolean;
  hasUnreadNotification: boolean;
  progress: TerminalProgress;
  commandStartTime: number | undefined;
  input: TerminalInput;
  cwd: string;
  scrolledLinesFromBottom: number;
  /**
   * Capabilities reported by the session's shell integration via the
   * COGNO:CAPS handshake; undefined until (and unless) the handshake arrives.
   */
  sessionCapabilities: ShellSessionCapabilitiesContract | undefined;
};

export const createInitialState = (backendOs: OsType): TerminalState => ({
  terminalId: "",
  cwd: "",
  shellContext: { shellType: "Bash", backendOs },
  cursorPosition: {
    viewport: { col: 1, row: 1 },
    col: 1,
    row: 1,
    char: "",
  },
  mousePosition: {
    viewport: { col: 1, row: 1 },
    col: 1,
    row: 1,
    char: "",
  },
  dimensions: {
    rows: 0,
    cols: 0,
    cellHeight: 0,
    cellWidth: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  },
  isFocused: false,
  hasSelection: false,
  isCommandRunning: false,
  isInFullScreenMode: false,
  isPaneMaximized: false,
  hasUnreadNotification: false,
  progress: {
    state: "hidden",
    value: 0,
  },
  commandStartTime: undefined,
  input: { cursorIndex: 0, maxCursorIndex: 0, text: "" },
  scrolledLinesFromBottom: 0,
  sessionCapabilities: undefined,
});
