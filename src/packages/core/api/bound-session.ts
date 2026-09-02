import { TerminalId } from "@cogno/shared/ports";

/**
 * What a feature captured about the session it is acting on. injectInput/run
 * recheck this against the live session immediately before writing, so a write
 * meant for one session can never land in another after the focus moved
 * (ARCHITECTURE.md 2.3, the two axes).
 */
export interface BoundSessionIdentity {
  readonly terminalId: TerminalId;
  /** The session's trust token; undefined before the shell handshake. */
  readonly sessionToken: string | undefined;
}

/** Whether the binding tracks focus or is pinned to one session. */
export type BoundSessionMode = "following" | "held";

/**
 * The session the API is currently bound to, as one of four states:
 * - unbound: nothing to act on (no focus, or a held session ended).
 * - active: bound and writable.
 * - closing / closed: the bound session is ending; a following binding moves
 *   on to the next focus, a held one falls back to unbound.
 */
export type BoundSession =
  | { readonly status: "unbound" }
  | {
      readonly status: "active";
      readonly identity: BoundSessionIdentity;
      readonly mode: BoundSessionMode;
    }
  | { readonly status: "closing"; readonly identity: BoundSessionIdentity }
  | { readonly status: "closed"; readonly identity: BoundSessionIdentity };
