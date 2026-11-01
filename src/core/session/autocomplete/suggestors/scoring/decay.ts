/** Saturating count: 0 for non-positive values, approaches 1 as `value` grows past `k`. */
export function sat(value: number, k: number): number {
  if (value <= 0) return 0;
  return value / (value + k);
}

/** Exponential half-life decay in [0, 1]; 0 for an unknown (infinite) or invalid age. */
export function recencyDecay(ageMs: number, halfLifeMs: number): number {
  if (!Number.isFinite(ageMs) || ageMs < 0 || halfLifeMs <= 0) return 0;
  return Math.exp(-Math.LN2 * (ageMs / halfLifeMs));
}

/** Age of a timestamp in ms; infinite when the timestamp is missing or invalid. */
export function safeAge(now: number, ts?: number): number {
  if (!ts || !Number.isFinite(ts) || ts <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - ts);
}
