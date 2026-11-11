import { OsType } from "@cogno/platform/os";

/** Where a session's shell runs. */
export type SessionBackend = {
  /** The machine from `remote.hosts`; left out for this one. */
  readonly host?: string;
  /**
   * The operating system the shell runs on. With a host on another machine
   * that is not the one the window runs on.
   */
  readonly os: OsType;
};
