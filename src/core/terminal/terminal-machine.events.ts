/** Size of a terminal in character cells. */
export type TerminalDimensions = { rows: number; cols: number };

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
