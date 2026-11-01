import { hexColorSchema } from "@cogno/core/api/contributions";
import { z } from "zod";

export const SelectionSchema = z.strictObject({
  clear_on_copy: z.boolean().optional().describe("Clear the selection right after copying."),
  background_color: hexColorSchema
    .optional()
    .describe("Background color of selected text in the focused terminal."),
  inactive_background_color: hexColorSchema
    .optional()
    .describe("Background color of selected text in an unfocused terminal."),
  right_click_selects_word: z
    .boolean()
    .optional()
    .describe("Right-click selects the word under the pointer."),
});

export type Selection = z.infer<typeof SelectionSchema>;
