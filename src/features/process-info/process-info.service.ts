import { DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BoundSession, BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import { ProcessTreeSnapshot } from "@cogno/platform/pty";

const REFRESH_INTERVAL_MS = 2_000;

/** What the panel shows besides the tree: the bound session's overall state. */
export type ProcessInfoBinding = "unbound" | "active" | "closing" | "closed";

@Injectable({ providedIn: "root" })
export class ProcessInfoService {
  private readonly snapshotSignal = signal<ProcessTreeSnapshot | null>(null);
  private readonly errorSignal = signal<boolean>(false);
  private readonly loadingSignal = signal(false);
  private readonly heldSignal = signal(false);
  private readonly bindingSignal = signal<ProcessInfoBinding>("unbound");

  readonly snapshot = this.snapshotSignal.asReadonly();
  readonly hasError = this.errorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly held = this.heldSignal.asReadonly();
  readonly binding = this.bindingSignal.asReadonly();

  private boundSession: BoundSessionHandle | null = null;
  private active = false;
  private refreshTimer?: number;
  private refreshInFlight = false;

  constructor(
    private readonly sessionApi: SessionApi,
    destroyRef: DestroyRef,
  ) {
    sessionApi.boundSession$.pipe(takeUntilDestroyed(destroyRef)).subscribe((boundSession) => {
      this.onBoundSessionChange(boundSession);
    });
    destroyRef.onDestroy(() => this.stop());
  }

  /** Panel opened: start following and polling the bound session. */
  start(): void {
    if (this.active) return;
    this.active = true;
    void this.refresh(true);
    this.refreshTimer = window.setInterval(() => {
      void this.refresh(false);
    }, REFRESH_INTERVAL_MS);
  }

  /** Panel closed: stop polling. Any hold is released so focus is followed again. */
  stop(): void {
    this.active = false;
    if (this.refreshTimer !== undefined) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    if (this.heldSignal()) {
      this.sessionApi.release();
      this.heldSignal.set(false);
    }
  }

  /** Pin the panel to the current session, or return to following focus. */
  toggleHold(): void {
    if (this.heldSignal()) {
      this.sessionApi.release();
      this.heldSignal.set(false);
    } else {
      this.sessionApi.hold();
      this.heldSignal.set(true);
    }
  }

  private onBoundSessionChange(boundSession: BoundSession): void {
    this.bindingSignal.set(boundSession.status);
    this.boundSession = boundSession.status === "active" ? boundSession.session : null;
    if (!this.boundSession) {
      this.snapshotSignal.set(null);
      this.errorSignal.set(false);
    }
    if (this.active) void this.refresh(true);
  }

  private async refresh(showLoading: boolean): Promise<void> {
    if (this.refreshInFlight) return;
    const session = this.boundSession;
    if (!session) return;
    this.refreshInFlight = true;
    try {
      if (showLoading) this.loadingSignal.set(true);
      const snapshot = await session.processTree();
      this.snapshotSignal.set(snapshot);
      this.errorSignal.set(false);
    } catch {
      // A rejection (focus moved, session ended) just leaves the last tree; a
      // real failure surfaces as the error state.
      if (this.boundSession === session) {
        this.errorSignal.set(true);
      }
    } finally {
      if (showLoading) this.loadingSignal.set(false);
      this.refreshInFlight = false;
    }
  }
}
