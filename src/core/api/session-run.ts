import {
  CommandRunnerResultContract,
  ProcessPromptHandler,
} from "@cogno/core/api/command-runner-port";

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
  /** Written to the process as its standard input, then closed. */
  readonly stdin?: string;
  /**
   * Answers what the process asks for without a terminal (credentials, a
   * passphrase, a host key). Without one the workbench shows a plain dialog
   * that knows nothing about the process.
   */
  readonly onPrompt?: ProcessPromptHandler;
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

export type SessionInsertRejection =
  | SessionRunRejection
  /** The shell is not at its prompt: a command or a full-screen program would get the text. */
  | "busy";

/** `insertInput` put the text on the line, or refused like `run` - or because the shell is busy. */
export type SessionInsertResult =
  | { readonly status: "inserted" }
  | { readonly status: "rejected"; readonly reason: SessionInsertRejection };
