import { hexColorSchema } from "@cogno/core/api/contributions";
import { z } from "zod";

/** Descriptions feed the generated settings reference (`pnpm generate:config-docs`). */
export const ColorSchema = z.strictObject({
  foreground: hexColorSchema.optional().describe("Default text color of the terminal."),
  background: hexColorSchema.optional().describe("Terminal background color."),
  highlight: hexColorSchema
    .optional()
    .describe("Accent color for highlighted UI elements, e.g. the active tab."),
  black: hexColorSchema.optional().describe("ANSI color 0 (black)."),
  red: hexColorSchema.optional().describe("ANSI color 1 (red)."),
  green: hexColorSchema.optional().describe("ANSI color 2 (green)."),
  yellow: hexColorSchema.optional().describe("ANSI color 3 (yellow)."),
  blue: hexColorSchema.optional().describe("ANSI color 4 (blue)."),
  magenta: hexColorSchema.optional().describe("ANSI color 5 (magenta)."),
  cyan: hexColorSchema.optional().describe("ANSI color 6 (cyan)."),
  white: hexColorSchema.optional().describe("ANSI color 7 (white)."),
  bright_black: hexColorSchema.optional().describe("ANSI color 8 (bright black / grey)."),
  bright_red: hexColorSchema.optional().describe("ANSI color 9 (bright red)."),
  bright_green: hexColorSchema.optional().describe("ANSI color 10 (bright green)."),
  bright_yellow: hexColorSchema.optional().describe("ANSI color 11 (bright yellow)."),
  bright_blue: hexColorSchema.optional().describe("ANSI color 12 (bright blue)."),
  bright_magenta: hexColorSchema.optional().describe("ANSI color 13 (bright magenta)."),
  bright_cyan: hexColorSchema.optional().describe("ANSI color 14 (bright cyan)."),
  bright_white: hexColorSchema.optional().describe("ANSI color 15 (bright white)."),
});

export type Color = z.infer<typeof ColorSchema>;
