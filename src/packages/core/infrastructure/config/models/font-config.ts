import { z } from "zod";

export const FontWeightSchema = z.union([
  z.enum(["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"]),
  z.number(),
]);

export const AppFontSchema = z.object({
  family: z
    .string()
    .optional()
    .describe("Font family of the app UI (tabs, menus, panels) - not the terminal."),
  size: z
    .number()
    .int()
    .min(1, "Font size must be at least 1")
    .optional()
    .describe("Font size of the app UI in pixels."),
});

export const FontSchema = z.object({
  family: z.string().optional().describe("Terminal font family; falls back per OS when unset."),
  size: z
    .number()
    .int()
    .min(1, "Font size must be at least 1")
    .optional()
    .describe("Terminal font size in pixels."),
  enable_ligatures: z
    .boolean()
    .optional()
    .describe("Render programming ligatures (needs a font that has them)."),
  weight: FontWeightSchema.optional().describe("Weight of normal terminal text."),
  weight_bold: FontWeightSchema.optional().describe("Weight of bold terminal text."),
  custom_glyphs: z
    .boolean()
    .optional()
    .describe("Draw box-drawing and block characters instead of taking them from the font."),
  draw_bold_text_in_bright_colors: z
    .boolean()
    .optional()
    .describe("Render bold text in the bright ANSI colour variant."),
  rescale_overlapping_glyphs: z
    .boolean()
    .optional()
    .describe("Shrink glyphs that are wider than their cell so they stop overlapping."),
  app: AppFontSchema.optional().describe("Font of the app UI, separate from the terminal font."),
});

export type Font = z.infer<typeof FontSchema>;
