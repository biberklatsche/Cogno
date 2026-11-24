import { hexColorSchema, limitSchema } from "@cogno/core/api/contributions";
import { z } from "zod";

const decorationColorSchema = z.strictObject({
  background: hexColorSchema.optional().describe("Fill color of a match."),
  border: hexColorSchema.optional().describe("Border color of a match."),
  overview_ruler: hexColorSchema
    .optional()
    .describe("Color of the mark a match gets in the strip beside the scrollbar."),
});

export const TerminalConfigSchema = z.strictObject({
  webgl: z
    .boolean()
    .optional()
    .describe(
      "Draw the terminal with the graphics card, which is faster. Turn it off if text looks broken.",
    ),
  scrollback_lines: z
    .number()
    .int()
    .min(100, "Scrollback lines must be at least 100")
    .optional()
    .describe("How many lines of earlier output a terminal keeps for scrolling back."),
  decoration: z
    .strictObject({
      color: decorationColorSchema
        .optional()
        .describe("Colors of the matches a search finds in the terminal."),
      active_color: decorationColorSchema
        .optional()
        .describe("Colors of the match the search currently stands on."),
    })
    .optional()
    .describe("Colors of search matches in the terminal."),
  inactive_overlay_opacity: z
    .number()
    .int()
    .min(0, "Opacity must be at least 0")
    .max(100, "Opacity must be at most 100")
    .optional()
    .describe("How strongly panes that are not focused are dimmed, 0-100."),
  ignore_bracketed_paste_mode: z
    .boolean()
    .optional()
    .describe(
      "Paste text as if you had typed it. A line break in pasted text then runs the command at once.",
    ),
  minimum_contrast_ratio: z
    .number()
    .optional()
    .describe(
      "Adjust text colors until they stand out from their background by at least this ratio; 1 changes nothing.",
    ),
  screen_reader_mode: z
    .boolean()
    .optional()
    .describe("Let screen readers read the terminal output."),
  allow_transparency: z
    .boolean()
    .optional()
    .describe("Allow transparent background colors; costs some rendering performance."),
  tab_stop_width: z.number().optional().describe("Width of a tab character in columns."),
  word_separator: z
    .string()
    .optional()
    .describe("Characters that end a word when you double-click to select it."),
  progress_bar: z
    .strictObject({
      enabled: z
        .boolean()
        .optional()
        .describe("Show a progress bar in the terminal header while a program reports progress."),
    })
    .optional()
    .describe("Progress that programs report (OSC 9;4), shown in the terminal header."),
  images: z
    .strictObject({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "Show images that programs print into the terminal (sixel and iTerm2's OSC 1337).",
        ),
      storage_limit_mb: z
        .number()
        .min(1)
        .max(1000)
        .optional()
        .describe(
          "Megabytes of images each terminal keeps; when it is full the oldest images are replaced by a placeholder.",
        ),
    })
    .optional()
    .describe("Inline images in the terminal output."),
  history: z
    .strictObject({
      max_entries: limitSchema
        .optional()
        .describe(
          "How many commands the history keeps per shell, or `unlimited`; the oldest go first. 0 keeps none.",
        ),
      ignore_commands_with_leading_space: z
        .boolean()
        .optional()
        .describe(
          "Keep a command out of the history when you type a space in front of it, as bash and zsh do.",
        ),
      import_shell_history: z
        .boolean()
        .optional()
        .describe(
          "When the history is empty, fill it from your shell's own history file (bash, zsh, PowerShell).",
        ),
      auto_execute: z
        .boolean()
        .optional()
        .describe(
          "Run a command as soon as you pick it from the history. Off puts it on the input line and waits for Enter.",
        ),
    })
    .optional()
    .describe("The commands you ran, used by autocomplete and the command history."),
});
