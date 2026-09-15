/**
 * A feature is on or off. The earlier "hidden" and "visible" are read as
 * "on"; hiding an icon while keeping its keybinding was a display concern
 * dressed up as a mode (ARCHITECTURE.md, decision 4).
 */
export type FeatureModeContract = "off" | "on";

/** Values older configs may still carry; both mean "on". */
export const LEGACY_FEATURE_MODES = ["hidden", "visible"] as const;

/** Reads a configured mode, accepting the legacy spellings. */
export function normalizeFeatureMode(value: unknown): FeatureModeContract | undefined {
  if (value === "off" || value === "on") return value;
  if (value === "hidden" || value === "visible") return "on";
  return undefined;
}
