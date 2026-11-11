import { computed, DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BoundSession, SessionApi } from "@cogno/core/api/session-api";
import { ProcessTreeSnapshot } from "@cogno/platform/pty";
import {
  catchError,
  concat,
  EMPTY,
  exhaustMap,
  finalize,
  from,
  interval,
  Subscription,
  switchMap,
  tap,
} from "rxjs";

const REFRESH_INTERVAL_MS = 2_000;

@Injectable({ providedIn: "root" })
export class ProcessInfoService {
  private readonly boundSessionSignal = signal<BoundSession>({ status: "unbound" });
  private readonly snapshotSignal = signal<ProcessTreeSnapshot | null>(null);
  private readonly errorSignal = signal(false);
  private readonly loadingSignal = signal(false);

  readonly snapshot = this.snapshotSignal.asReadonly();
  readonly hasError = this.errorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  /** The bound session's overall state, shown besides the tree. */
  readonly binding = computed(() => this.boundSessionSignal().status);
  readonly held = computed(() => {
    const bound = this.boundSessionSignal();
    return bound.status === "active" && bound.session.mode === "held";
  });

  private readonly terminatingSignal = signal<ReadonlySet<number>>(new Set<number>());
  private readonly terminateFailureSignal = signal<{
    readonly terminalId: string;
    readonly processId: number;
  } | null>(null);

  /** The processes a terminate request is still running for. */
  readonly terminating = this.terminatingSignal.asReadonly();
  /** The process the last terminate request failed for, while its session is still the bound one. */
  readonly terminateFailed = computed(() => {
    const failure = this.terminateFailureSignal();
    const bound = this.boundSessionSignal();
    if (failure === null || bound.status !== "active") return null;
    return bound.session.identity.terminalId === failure.terminalId ? failure.processId : null;
  });

  private polling?: Subscription;

  constructor(
    private readonly sessionApi: SessionApi,
    destroyRef: DestroyRef,
  ) {
    sessionApi.boundSession$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((bound) => this.boundSessionSignal.set(bound));
    destroyRef.onDestroy(() => this.stop());
  }

  /**
   * Panel opened: poll the bound session's process tree. A newly bound session
   * replaces the poll at once, even while a tree is still loading; a poll that
   * is still running skips the next tick.
   */
  start(): void {
    if (this.polling) return;
    this.polling = this.sessionApi.boundSession$
      .pipe(
        switchMap((bound) => {
          if (bound.status !== "active") {
            this.snapshotSignal.set(null);
            this.errorSignal.set(false);
            return EMPTY;
          }
          const processTree = () => bound.session.processTree();
          return concat(
            this.load(processTree, true),
            interval(REFRESH_INTERVAL_MS).pipe(exhaustMap(() => this.load(processTree, false))),
          );
        }),
      )
      .subscribe();
  }

  /** Panel closed: stop polling. Any hold is released so focus is followed again. */
  stop(): void {
    this.polling?.unsubscribe();
    this.polling = undefined;
    if (this.held()) this.sessionApi.release();
  }

  /** Pin the panel to the current session, or return to following focus. */
  toggleHold(): void {
    if (this.held()) {
      this.sessionApi.release();
    } else {
      this.sessionApi.hold();
    }
  }

  /**
   * End a process of the bound session's tree, with everything it started. The
   * next poll shows the result; a failure is kept for the panel to show.
   */
  async terminate(processId: number): Promise<void> {
    const bound = this.boundSessionSignal();
    if (bound.status !== "active" || this.terminatingSignal().has(processId)) return;
    this.terminateFailureSignal.set(null);
    this.terminatingSignal.update((terminating) => new Set(terminating).add(processId));
    try {
      await bound.session.terminateProcess(processId);
    } catch {
      this.terminateFailureSignal.set({
        terminalId: bound.session.identity.terminalId,
        processId,
      });
    } finally {
      this.terminatingSignal.update((terminating) => {
        const next = new Set(terminating);
        next.delete(processId);
        return next;
      });
    }
  }

  /** The first load of a session shows the loading state; the polls after it do not. */
  private load(processTree: () => Promise<ProcessTreeSnapshot>, isFirst: boolean) {
    if (isFirst) this.loadingSignal.set(true);
    return from(processTree()).pipe(
      tap((snapshot) => {
        this.snapshotSignal.set(snapshot);
        this.errorSignal.set(false);
      }),
      // A rejection (focus moved, session ended) just leaves the last tree; a
      // real failure surfaces as the error state.
      catchError(() => {
        this.errorSignal.set(true);
        return EMPTY;
      }),
      finalize(() => {
        if (isFirst) this.loadingSignal.set(false);
      }),
    );
  }
}
