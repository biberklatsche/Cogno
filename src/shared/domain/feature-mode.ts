/**
 * A feature is on or off. The earlier "hidden" and "visible" are read as "on"
 * by the config schema; hiding an icon while keeping its keybinding was a
 * display concern dressed up as a mode (ARCHITECTURE.md, decision 4).
 */
export type FeatureModeContract = "off" | "on";
