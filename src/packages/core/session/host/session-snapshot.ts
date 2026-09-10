/** A restorable snapshot of one terminal session's buffer (step 27). */
export interface SessionSnapshot {
  readonly version: number;
  /** The serialized scrollback (text with ANSI), or null when not captured. */
  readonly scrollback: string | null;
}

export const SESSION_SNAPSHOT_VERSION = 1;
