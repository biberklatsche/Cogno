import { ProcessTreeSnapshot } from "@cogno/platform/pty";
import { ShellContextContract, TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";
import { BoundSessionIdentity, BoundSessionMode } from "./bound-session";
import { SessionInsertResult, SessionRunRequest, SessionRunResult } from "./session-run";

/**
 * The filesystem of the bound session, read in its live shell context (path
 * translation follows the current context timeline). Rejects when the binding
 * is no longer the live session or the context is unknown/remote - the same
 * guard as `run` (ARCHITECTURE.md 3).
 */
export interface BoundSessionFs {
  readTextFile(path: string): Promise<string>;
  normalizePath(path: string): string;
  /** `path`, in Cogno's form or as the operating system names it, as the session's shell writes it. */
  displayPath(path: string): string;
  /** Emits once per burst of changes under `path` (a directory, recursively). */
  watch$(path: string): Observable<void>;
}

/**
 * A live handle on the session the API is bound to. It carries the identity a
 * feature planned against and runs everything in that session's context:
 * `run` starts an own, invisible process, `fs` reads files, `insertInput`
 * puts text on the input line for the person to run; all recheck the
 * identity before they act so a write can never land in another session
 * after the focus moved. `contextRevision` is the revision to plan against
 * and pass back; `cwd`/`shellContext` are live.
 */
export interface BoundSessionHandle {
  readonly identity: BoundSessionIdentity;
  readonly mode: BoundSessionMode;
  readonly cwd: string;
  readonly shellContext: ShellContextContract;
  readonly contextRevision: number;
  run(request: SessionRunRequest): Promise<SessionRunResult>;
  /**
   * Types `text` on the session's input line, never Enter: the person reads
   * the command and runs it. Rejected on the same grounds as `run`, and as
   * `busy` while a command or a full-screen program would receive the text.
   */
  insertInput(text: string, contextRevision: number): Promise<SessionInsertResult>;
  readonly fs: BoundSessionFs;
  /**
   * A fresh, live process tree of the bound session on every call. Rejected
   * only when the identity is no longer the live bound session; unlike `run`
   * and `fs` it needs no known shell context, so it works for remote/ssh
   * sessions too.
   */
  processTree(): Promise<ProcessTreeSnapshot>;
}

/**
 * The bound session as a feature sees it: the `active` state carries the live
 * handle; the others carry only the identity that is ending.
 */
export type BoundSession =
  | { readonly status: "unbound" }
  | { readonly status: "active"; readonly session: BoundSessionHandle }
  | { readonly status: "closing"; readonly identity: BoundSessionIdentity }
  | { readonly status: "closed"; readonly identity: BoundSessionIdentity };

/**
 * One entry of the session directory: a live session, named by its terminal,
 * that a feature may run a command in. `run` rechecks that this very session
 * is still the live one behind the terminal (not a successor) and guards the
 * context like the bound handle does; it does not care about focus.
 * `contextRevision` is live, to plan a run against.
 */
export interface SessionHandle {
  readonly terminalId: TerminalId;
  readonly contextRevision: number;
  run(request: SessionRunRequest): Promise<SessionRunResult>;
}

/**
 * What a session-bound feature imports from `core/api`: the session it is bound
 * to (following focus unless held) and a signal that its cwd changed, so it can
 * re-derive its own facts. Everything context-bound goes through the handle.
 * `sessions$` is the directory of every live session for a feature that shows
 * all of them at once; it emits a new list when a session starts or ends.
 */
export abstract class SessionApi {
  abstract readonly boundSession$: Observable<BoundSession>;
  abstract readonly cwdChanges$: Observable<void>;
  abstract readonly sessions$: Observable<ReadonlyArray<SessionHandle>>;
  /** Pin the binding to the current session so it stops following focus. */
  abstract hold(): void;
  /** Return to following focus. */
  abstract release(): void;
}
