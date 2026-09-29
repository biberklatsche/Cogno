/** Failures in a row before writes back off. */
const BACKOFF_AFTER_FAILURES = 3;

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/**
 * How badly the command log is failing.
 *
 * Recording must never slow a session down, so a write that cannot land is
 * dropped rather than waited for. Every loss is counted for the error report,
 * and while the database keeps failing, writes back off. Plain object, no
 * framework, no timers - the caller decides when to wait; this only says how
 * long.
 */
export class CommandLogHealthTracker {
  private consecutiveFailures = 0;
  private droppedWrites = 0;

  /** Writes given up on since the session started. */
  get dropped(): number {
    return this.droppedWrites;
  }

  /** How long to wait before the next attempt. Zero while things are fine. */
  get backoffMs(): number {
    if (this.consecutiveFailures < BACKOFF_AFTER_FAILURES) return 0;
    const steps = this.consecutiveFailures - BACKOFF_AFTER_FAILURES;
    return Math.min(BASE_BACKOFF_MS * 2 ** steps, MAX_BACKOFF_MS);
  }

  /** A write was thrown away because the queue was full. */
  recordOverflow(): void {
    this.droppedWrites += 1;
  }

  /** A write landed. Clears the failure streak. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /** A write failed for good, after its retry. */
  recordFailure(): void {
    this.consecutiveFailures += 1;
    this.droppedWrites += 1;
  }
}
