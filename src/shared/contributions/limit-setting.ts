import { z } from "zod";

/** How a limit setting says "no limit" in the config file. */
export const UNLIMITED = "unlimited";

export type Limit = number | typeof UNLIMITED;

/**
 * A limit the user can lift: a whole number, or `unlimited`. A number is taken
 * literally - `0` keeps nothing or lasts no time, it never means "no limit".
 */
export const limitSchema = (minimum = 0) =>
  z.union([z.literal(UNLIMITED), z.number().int().min(minimum)]);

/** The limit as a number: `Infinity` when unlimited, the fallback when unset or malformed. */
export function resolveLimit(value: unknown, fallback: Limit): number {
  const limit = value === UNLIMITED || typeof value === "number" ? value : fallback;
  return limit === UNLIMITED ? Number.POSITIVE_INFINITY : limit;
}
