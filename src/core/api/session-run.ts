import { CommandRunnerResultContract } from "@cogno/shared/ports";

/** A command a feature asks to run on the session it is bound to. */
export interface SessionRunRequest {
  readonly executable: string;
  readonly args?: ReadonlyArray<string>;
  /**
   * The context revision the caller planned against. If the session has moved
   * on (a nested shell opened or closed) the run is rejected, so a command is
   * never run in a context the caller did not mean.
   */
  readonly contextRevision: number;
  readonly timeoutMs?: number;
}

export type SessionRunRejection =
  /** The identity is not the session bound right now, or it is gone. */
  | "unbound"
  /** The session's context moved since the caller planned against it. */
  | "stale-context"
  /** The session is in a foreign/unauthenticated context (e.g. ssh). */
  | "unknown-context";

export type SessionRunResult =
  | { readonly status: "ran"; readonly result: CommandRunnerResultContract }
  | { readonly status: "rejected"; readonly reason: SessionRunRejection };
