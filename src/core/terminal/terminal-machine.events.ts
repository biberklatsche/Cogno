/** Size of a terminal in character cells. */
export type TerminalDimensions = { rows: number; cols: number };

/** Whole, positive rows and columns; the fit addon and the DOM can hand over anything else. */
export function isValidTerminalDimensions(dimensions: {
  rows?: number | null;
  cols?: number | null;
}): dimensions is TerminalDimensions {
  const { cols, rows } = dimensions;
  return (
    typeof cols === "number" &&
    typeof rows === "number" &&
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    cols > 0 &&
    rows > 0
  );
}

/**
 * Something the machine could not do. It reports rather than handles: the
 * machine has no reporter and no notifications (ARCHITECTURE.md 2.1), so it
 * says what happened and the session host decides who hears about it.
 */
export type TerminalMachineFault = {
  readonly operation: string;
  readonly error: unknown;
  readonly context?: Readonly<Record<string, string | number | undefined>>;
};
