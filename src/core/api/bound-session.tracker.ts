import { TerminalId } from "@cogno/shared/domain";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { distinctUntilChanged } from "rxjs/operators";
import { BoundSessionIdentity, BoundSessionMode, SessionBinding } from "./bound-session";

/** The bound session's lifecycle, reduced to what the binding cares about. */
export type BoundRuntimeStatus = "active" | "closing" | "closed";

/**
 * Tracks which session the API is bound to. It follows focus until `hold()`
 * pins it; `release()` returns to following the current focus. When the bound
 * session ends it surfaces `closing` then `closed`; a following binding then
 * moves on with the next focus, a held one falls back to `unbound`.
 *
 * Framework-light on purpose: it takes the focus stream and two lookups so it
 * can be tested without Angular or a live registry.
 */
export class BoundSessionTracker {
  private readonly state = new BehaviorSubject<SessionBinding>({ status: "unbound" });
  private mode: BoundSessionMode = "following";
  private lastFocus: TerminalId | undefined;
  private boundId: TerminalId | undefined;
  private runtimeSubscription?: Subscription;

  readonly binding$: Observable<SessionBinding> = this.state.pipe(
    distinctUntilChanged(sessionBindingsEqual),
  );

  constructor(
    focusedTerminalId$: Observable<TerminalId | undefined>,
    private readonly identityOf: (terminalId: TerminalId) => BoundSessionIdentity | undefined,
    private readonly runtimeOf: (terminalId: TerminalId) => Observable<BoundRuntimeStatus>,
  ) {
    focusedTerminalId$.subscribe((terminalId) => {
      this.lastFocus = terminalId;
      if (this.mode === "following") {
        this.bindTo(terminalId);
      }
    });
  }

  get binding(): SessionBinding {
    return this.state.value;
  }

  /** Pin the binding to the current session; focus changes no longer move it. */
  hold(): void {
    if (this.state.value.status !== "active") {
      return;
    }
    this.mode = "held";
    this.state.next({ status: "active", identity: this.state.value.identity, mode: "held" });
  }

  /** Follow focus again, binding to whatever is focused now. */
  release(): void {
    this.mode = "following";
    this.bindTo(this.lastFocus);
  }

  private bindTo(terminalId: TerminalId | undefined): void {
    this.boundId = terminalId;
    this.runtimeSubscription?.unsubscribe();
    this.runtimeSubscription = undefined;

    const identity = terminalId === undefined ? undefined : this.identityOf(terminalId);
    if (terminalId === undefined || identity === undefined) {
      this.state.next({ status: "unbound" });
      return;
    }

    this.runtimeSubscription = this.runtimeOf(terminalId).subscribe((status) => {
      // A late tick from a session we already left must not steer the binding.
      if (this.boundId !== terminalId) {
        return;
      }
      if (status === "active") {
        this.state.next({ status: "active", identity, mode: this.mode });
      } else if (status === "closing") {
        this.state.next({ status: "closing", identity });
      } else {
        this.state.next({ status: "closed", identity });
        if (this.mode === "held") {
          // A held session that ends releases the hold and goes unbound; the
          // next focus binds again through following.
          this.mode = "following";
          this.boundId = undefined;
          this.runtimeSubscription?.unsubscribe();
          this.runtimeSubscription = undefined;
          this.state.next({ status: "unbound" });
        }
        // Following: the closed pane's removal focuses another session, which
        // rebinds us through the focus subscription.
      }
    });
  }
}

function sessionBindingsEqual(left: SessionBinding, right: SessionBinding): boolean {
  if (left.status !== right.status) {
    return false;
  }
  if (left.status === "unbound" || right.status === "unbound") {
    return true;
  }
  const sameTerminal = left.identity.terminalId === right.identity.terminalId;
  const sameMode =
    left.status === "active" && right.status === "active" ? left.mode === right.mode : true;
  return sameTerminal && sameMode;
}
