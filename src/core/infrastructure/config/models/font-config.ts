import { z } from "zod";

/**
 * The CSS keywords and the nine numeric weights; a bare `400` in the file
 * reads as "400". Literals rather than `z.enum`, so the keywords stay first
 * in the reference and the panel (an enum's numeric keys would sort ahead).
 */
const FontWeightSchema = z.union([
  z.literal("normal"),
  z.literal("bold"),
  z.literal("100"),
  z.literal("200"),
  z.literal("300"),
  z.literal("400"),
  z.literal("500"),
  z.literal("600"),
  z.literal("700"),
  z.literal("800"),
  z.literal("900"),
]);

const AppFontSchema = z.strictObject({
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

export const FontSchema = z.strictObject({
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
    .describe("Render bold text in the bright ANSI color variant."),
  rescale_overlapping_glyphs: z
    .boolean()
    .optional()
    .describe("Shrink glyphs that are wider than their cell so they stop overlapping."),
  app: AppFontSchema.meta({ title: "App UI" })
    .optional()
    .describe("Font of the app UI, separate from the terminal font."),
});

export type Font = z.infer<typeof FontSchema>;
