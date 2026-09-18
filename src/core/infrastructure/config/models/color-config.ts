import { z } from "zod";
import { HexColorSchema } from "./shared";

/** Descriptions feed the generated settings reference (`pnpm generate:config-docs`). */
export const ColorSchema = z.object({
  foreground: HexColorSchema.optional().describe("Default text colour of the terminal."),
  background: HexColorSchema.optional().describe("Terminal background colour."),
  highlight: HexColorSchema.optional().describe(
    "Accent colour for highlighted UI elements, e.g. the active tab.",
  ),
  black: HexColorSchema.optional().describe("ANSI colour 0 (black)."),
  red: HexColorSchema.optional().describe("ANSI colour 1 (red)."),
  green: HexColorSchema.optional().describe("ANSI colour 2 (green)."),
  yellow: HexColorSchema.optional().describe("ANSI colour 3 (yellow)."),
  blue: HexColorSchema.optional().describe("ANSI colour 4 (blue)."),
  magenta: HexColorSchema.optional().describe("ANSI colour 5 (magenta)."),
  cyan: HexColorSchema.optional().describe("ANSI colour 6 (cyan)."),
  white: HexColorSchema.optional().describe("ANSI colour 7 (white)."),
  bright_black: HexColorSchema.optional().describe("ANSI colour 8 (bright black / grey)."),
  bright_red: HexColorSchema.optional().describe("ANSI colour 9 (bright red)."),
  bright_green: HexColorSchema.optional().describe("ANSI colour 10 (bright green)."),
  bright_yellow: HexColorSchema.optional().describe("ANSI colour 11 (bright yellow)."),
  bright_blue: HexColorSchema.optional().describe("ANSI colour 12 (bright blue)."),
  bright_magenta: HexColorSchema.optional().describe("ANSI colour 13 (bright magenta)."),
  bright_cyan: HexColorSchema.optional().describe("ANSI colour 14 (bright cyan)."),
  bright_white: HexColorSchema.optional().describe("ANSI colour 15 (bright white)."),
});

export type Color = z.infer<typeof ColorSchema>;
