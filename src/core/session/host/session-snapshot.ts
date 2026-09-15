/** One restored prompt marker's metadata, so its decoration renders (step 27). */
export interface CommandSnapshot {
  readonly id: string;
  readonly directory: string;
  readonly machine: string;
  readonly user: string;
  readonly data: Record<string, string>;
}

/** A restorable snapshot of one terminal session's buffer (step 27). */
export interface SessionSnapshot {
  readonly version: number;
  /** The serialized scrollback (text with SGR colours + attributes), or null. */
  readonly scrollback: string | null;
  /** Per-marker command metadata, so restored decorations render. */
  readonly commands: readonly CommandSnapshot[];
}

// v3: SGR-rich scrollback (keeps colours and the concealed `^^#` marker lines)
// plus per-command metadata, so a restored session looks and behaves like it did
// at close. v1 (SerializeAddon ANSI) and v2 (plain text, markers stripped) are
// ignored on load.
export const SESSION_SNAPSHOT_VERSION = 3;
