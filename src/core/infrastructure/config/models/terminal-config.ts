import { hexColorSchema, limitSchema } from "@cogno/core/api/contributions";
import { z } from "zod";

const decorationColorSchema = z.strictObject({
  background: hexColorSchema.optional().describe("Fill color of the highlight."),
  border: hexColorSchema.optional().describe("Border color of the highlight."),
  overview_ruler: hexColorSchema.optional().describe("Color of its marker beside the scrollbar."),
});

export const TerminalConfigSchema = z.strictObject({
  keep_shells_running: z
    .boolean()
    .optional()
    .describe(
      "Keep your shells running when you quit Cogno. At the next start, your tabs show the same shells again. Meanwhile, Cogno on another machine can still show them (see `remote.hosts`). Closing a tab still ends its shell. Applies to shells started after you change it.",
    ),
  webgl: z
    .boolean()
    .optional()
    .describe(
      "Draw the terminal with the graphics card, which is faster. Turn it off if text looks broken.",
    ),
  decoration: z
    .strictObject({
      color: decorationColorSchema.optional().describe("Colors of all search matches."),
      active_color: decorationColorSchema
        .optional()
        .describe("Colors of the selected search match."),
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
  restore: z
    .strictObject({
      enabled: z
        .boolean()
        .optional()
        .describe(
          "Bring back your workspaces, tabs, panes and terminal output when Cogno starts. Off starts fresh each time; you save workspaces by hand instead.",
        ),
      scrollback: z
        .boolean()
        .optional()
        .describe(
          "Bring back what the terminals showed, above a separator line. Off restores the layout with empty terminals.",
        ),
      max_lines: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "How many lines of output are kept per terminal for the next start; 0 keeps none.",
        ),
    })
    .optional()
    .describe("Session restore: bring workspaces, tabs and scrollback back on the next launch."),
});
