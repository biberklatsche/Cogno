/** A restorable snapshot of one terminal session's buffer (step 27). */
export interface SessionSnapshot {
  readonly version: number;
  /** The serialized scrollback (text with ANSI), or null when not captured. */
  readonly scrollback: string | null;
}

// v2: plain-text scrollback (v1 was SerializeAddon ANSI, which corrupted the
// live session on replay). v1 snapshots are ignored on load.
export const SESSION_SNAPSHOT_VERSION = 2;
