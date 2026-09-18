import { z } from "zod";
import { HexColorSchema } from "./shared";

export const ScrollbarSchema = z.object({
  width: z
    .number()
    .int()
    .min(0, "Cursor-With must be at least 0")
    .optional()
    .describe("Scrollbar width in pixels; 0 hides it."),
  overview_ruler_border_color: HexColorSchema.optional().describe(
    "Border colour of the overview ruler next to the scrollbar.",
  ),
  slider_color: HexColorSchema.optional().describe("Scrollbar slider colour."),
  slider_hover_color: HexColorSchema.optional().describe("Scrollbar slider colour while hovered."),
  slider_active_color: HexColorSchema.optional().describe(
    "Scrollbar slider colour while being dragged.",
  ),
  sensitivity: z
    .number()
    .int()
    .min(0, "Scrollbar sensitivity must be at least 0")
    .optional()
    .describe("Lines scrolled per mouse-wheel notch."),
  scroll_on_user_input: z
    .boolean()
    .optional()
    .describe("Jump to the bottom when you start typing."),
  smooth_scroll_duration: z
    .number()
    .int()
    .min(0, "Scrollbar smooth scroll duration must be at least 0")
    .optional()
    .describe("Duration of smooth scrolling in milliseconds; 0 disables it."),
  fast_scroll_sensitivity: z
    .number()
    .int()
    .min(0, "Scrollbar smooth scroll duration must be at least 0")
    .optional()
    .describe("Scroll multiplier while the fast-scroll modifier is held."),
  scrollback_lines: z
    .number()
    .int()
    .min(100, "Scrollback lines must be at least 100")
    .optional()
    .describe("How many lines of scrollback the terminal keeps."),
});

export type Scrollbar = z.infer<typeof ScrollbarSchema>;
