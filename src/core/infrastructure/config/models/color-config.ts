import { z } from "zod";
import { HexColorSchema } from "./shared";

/** Descriptions feed the generated settings reference (`pnpm generate:config-docs`). */
export const ColorSchema = z.strictObject({
  foreground: HexColorSchema.optional().describe("Default text color of the terminal."),
  background: HexColorSchema.optional().describe("Terminal background color."),
  highlight: HexColorSchema.optional().describe(
    "Accent color for highlighted UI elements, e.g. the active tab.",
  ),
  black: HexColorSchema.optional().describe("ANSI color 0 (black)."),
  red: HexColorSchema.optional().describe("ANSI color 1 (red)."),
  green: HexColorSchema.optional().describe("ANSI color 2 (green)."),
  yellow: HexColorSchema.optional().describe("ANSI color 3 (yellow)."),
  blue: HexColorSchema.optional().describe("ANSI color 4 (blue)."),
  magenta: HexColorSchema.optional().describe("ANSI color 5 (magenta)."),
  cyan: HexColorSchema.optional().describe("ANSI color 6 (cyan)."),
  white: HexColorSchema.optional().describe("ANSI color 7 (white)."),
  bright_black: HexColorSchema.optional().describe("ANSI color 8 (bright black / grey)."),
  bright_red: HexColorSchema.optional().describe("ANSI color 9 (bright red)."),
  bright_green: HexColorSchema.optional().describe("ANSI color 10 (bright green)."),
  bright_yellow: HexColorSchema.optional().describe("ANSI color 11 (bright yellow)."),
  bright_blue: HexColorSchema.optional().describe("ANSI color 12 (bright blue)."),
  bright_magenta: HexColorSchema.optional().describe("ANSI color 13 (bright magenta)."),
  bright_cyan: HexColorSchema.optional().describe("ANSI color 14 (bright cyan)."),
  bright_white: HexColorSchema.optional().describe("ANSI color 15 (bright white)."),
});

export type Color = z.infer<typeof ColorSchema>;
