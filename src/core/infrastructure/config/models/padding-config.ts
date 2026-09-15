import { z } from "zod";

const PaddingValueSchema = z.number().min(0);

export const PaddingSchema = z.object({
  left: PaddingValueSchema.optional().describe("Padding between terminal content and left edge."),
  right: PaddingValueSchema.optional().describe("Padding between terminal content and right edge."),
  top: PaddingValueSchema.optional().describe("Padding between terminal content and top edge."),
  bottom: PaddingValueSchema.optional().describe(
    "Padding between terminal content and bottom edge.",
  ),
  remove_on_full_screen_app: z
    .boolean()
    .optional()
    .describe("Drop the padding while a full-screen app (vim, less) owns the screen."),
});

export type Padding = z.infer<typeof PaddingSchema>;
