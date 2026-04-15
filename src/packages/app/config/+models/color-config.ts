import { z } from "zod";
import { HexColorSchema } from "./shared";

export const ColorSchema = z.object({
  foreground: HexColorSchema.optional(),
  background: HexColorSchema.optional(),
  highlight: HexColorSchema.optional(),
  black: HexColorSchema.optional(),
  red: HexColorSchema.optional(),
  green: HexColorSchema.optional(),
  yellow: HexColorSchema.optional(),
  blue: HexColorSchema.optional(),
  magenta: HexColorSchema.optional(),
  cyan: HexColorSchema.optional(),
  white: HexColorSchema.optional(),
  bright_black: HexColorSchema.optional(),
  bright_red: HexColorSchema.optional(),
  bright_green: HexColorSchema.optional(),
  bright_yellow: HexColorSchema.optional(),
  bright_blue: HexColorSchema.optional(),
  bright_magenta: HexColorSchema.optional(),
  bright_cyan: HexColorSchema.optional(),
  bright_white: HexColorSchema.optional(),
});

export type Color = z.infer<typeof ColorSchema>;
