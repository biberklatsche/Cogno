/** xterm's cursor shapes. */
export type ICursorStyle = "block" | "underline" | "bar";

/** Where the cursor or the mouse is, in cells. */
type Position = { col: number; row: number };

export type TerminalCursorPosition = Position & {
  viewport: Position;
  char: string;
};

export type TerminalMousePosition = Position & {
  viewport: Position;
  char: string;
};

/** The terminal's size, in cells and in pixels. */
export type TerminalViewportDimensions = {
  rows: number;
  cols: number;
  cellHeight: number;
  cellWidth: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

/**
 * What the machine reports about itself: where things are, how big it is,
 * what is selected, how far it is scrolled.
 *
 * Deliberately narrow. The machine writes here and reads nothing back; who
 * keeps the state and what else it holds is none of its business
 * (ARCHITECTURE.md 2.1).
 */
export interface TerminalMachineState {
  updateCursorPosition(position: TerminalCursorPosition): void;
  updateMousePosition(position: TerminalMousePosition): void;
  updateDimensions(dimensions: TerminalViewportDimensions): void;
  setHasSelection(hasSelection: boolean): void;
  setScrolledLinesFromBottom(scrolledLinesFromBottom: number): void;
}
