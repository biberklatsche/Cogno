/**
 * How well the command log is keeping up.
 *
 * Recording must never slow a session down, so a write that cannot land is
 * dropped rather than waited for. Dropping silently would be worse than the
 * loss itself (ARCHITECTURE.md 4.3), so every loss is counted and the state
 * says why.
 */
export type CommandLogHealth = {
  readonly state: "ok" | "degraded" | "unavailable";
  /** Why it is not `ok`; undefined while it is. */
  readonly reason?: "backpressure" | "write-error";
  /** Writes given up on since the session started. */
  readonly dropped: number;
  /** Writes waiting in the queue. */
  readonly pending: number;
  /** How long the last successful write took, in milliseconds. */
  readonly lastWriteMs?: number;
};

export const HEALTHY: CommandLogHealth = { state: "ok", dropped: 0, pending: 0 };

/** Failures in a row before the log counts as unavailable rather than shaky. */
const UNAVAILABLE_AFTER_FAILURES = 3;

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Tracks the state above. Plain object, no framework, no timers - the caller
 * decides when to wait; this only says how long.
 */
export class CommandLogHealthTracker {
  private state: CommandLogHealth = HEALTHY;
  private consecutiveFailures = 0;

  get current(): CommandLogHealth {
    return this.state;
  }

  /** How long to wait before the next attempt. Zero while things are fine. */
  get backoffMs(): number {
    if (this.consecutiveFailures < UNAVAILABLE_AFTER_FAILURES) return 0;
    const steps = this.consecutiveFailures - UNAVAILABLE_AFTER_FAILURES;
    return Math.min(BASE_BACKOFF_MS * 2 ** steps, MAX_BACKOFF_MS);
  }

  setPending(pending: number): void {
    if (this.state.pending === pending) return;
    this.state = { ...this.state, pending };
  }

  /** A write was thrown away because the queue was full. */
  recordOverflow(pending: number): void {
    this.state = {
      state: "degraded",
      reason: "backpressure",
      dropped: this.state.dropped + 1,
      pending,
      lastWriteMs: this.state.lastWriteMs,
    };
  }

  /** A write landed. Clears the failure streak. */
  recordSuccess(durationMs: number, pending: number): void {
    this.consecutiveFailures = 0;
    this.state = { state: "ok", dropped: this.state.dropped, pending, lastWriteMs: durationMs };
  }

  /** A write failed for good, after its retry. */
  recordFailure(pending: number): void {
    this.consecutiveFailures += 1;
    this.state = {
      state: this.consecutiveFailures >= UNAVAILABLE_AFTER_FAILURES ? "unavailable" : "degraded",
      reason: "write-error",
      dropped: this.state.dropped + 1,
      pending,
      lastWriteMs: this.state.lastWriteMs,
    };
  }
}
