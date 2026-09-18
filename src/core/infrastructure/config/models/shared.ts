import { z } from "zod";

export const HexColorSchema = z.preprocess(
  (val) => (typeof val === "string" && val.startsWith("#") ? val.slice(1) : val),
  z
    .string()
    .regex(
      /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
      "Must be a 4-, 6-, or 8-digit hex color",
    ),
);

export type HexColor = z.infer<typeof HexColorSchema>;

const FeatureModeEnum = z.preprocess(
  (value) => (value === "hidden" || value === "visible" ? "on" : value),
  z.enum(["off", "on"]),
);

export type FeatureMode = z.infer<typeof FeatureModeEnum>;

export const TerminalNamedColorSchema = z.union([
  z.literal("black"),
  z.literal("red"),
  z.literal("green"),
  z.literal("yellow"),
  z.literal("blue"),
  z.literal("magenta"),
  z.literal("cyan"),
  z.literal("white"),
  z.literal("brightBlack"),
  z.literal("brightRed"),
  z.literal("brightGreen"),
  z.literal("brightYellow"),
  z.literal("brightBlue"),
  z.literal("brightMagenta"),
  z.literal("brightCyan"),
  z.literal("brightWhite"),
]);

export type TerminalNamedColor = z.infer<typeof TerminalNamedColorSchema>;

/** The 16 ANSI color names a prompt segment may use, e.g. `red`, `brightRed`. */
export const terminalColorNames: ReadonlyArray<TerminalNamedColor> =
  TerminalNamedColorSchema.options.map((option) => option.value);

const splitCamelCase = (name: string, joiner: string) =>
  name.replace(/[A-Z]/g, (letter) => `${joiner}${letter.toLowerCase()}`);

/** `brightRed` -> `bright_red`, its key under `color.*`. */
export const terminalColorConfigKey = (name: TerminalNamedColor) => splitCamelCase(name, "_");

/** `brightRed` -> `--color-bright-red`, the CSS variable the theme sets for it. */
export const terminalColorCssVariable = (name: TerminalNamedColor) =>
  `--color-${splitCamelCase(name, "-")}`;
