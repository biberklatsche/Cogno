import { z } from "zod";
import { HexColorSchema } from "./shared";

export const CursorSchema = z.strictObject({
  width: z
    .number()
    .int()
    .min(0, "Cursor-With must be at least 0")
    .max(10, "Cursor-With must be at most 10")
    .optional()
    .describe("Cursor width in pixels; applies to the bar style."),
  blink: z.boolean().optional().describe("Let the cursor blink."),
  style: z
    .enum(["bar", "underline", "block"])
    .optional()
    .describe("Cursor shape while the terminal has focus."),
  inactive_style: z
    .enum(["outline", "block", "bar", "underline", "none"])
    .optional()
    .describe("Cursor shape while the terminal does not have focus."),
  color: HexColorSchema.optional().describe("Cursor color."),
  accent_color: HexColorSchema.optional().describe(
    "Color of the character underneath a block cursor.",
  ),
  alt_click_moves_cursor: z
    .boolean()
    .optional()
    .describe("Alt+click moves the shell cursor to the clicked position."),
});

export type Cursor = z.infer<typeof CursorSchema>;
